"use strict"

import { odmah, container, step_out, text, attr, style, set_style, cls, hook, element, get_element_state, get_current_cursor, request_rerender, cursor_inert, get_attr } from "../odmah.js";
import { $text, select, button } from "./shared.js";
import { create_router } from "../modules/routing.js";
import { container_id } from "../modules/utils/simple_id.js";
import { html, raw, dedent } from "../modules/utils.js";
import { markdown } from "../modules/markdown.js";
import { register as register_todos } from "./todos.js";

// function get_css_vars() {
//     let vars = /** @type {Record<string, string>} */({});
//     for (let i=0; i<document.styleSheets.length; i++) {
//         let sheet = document.styleSheets[i];
//         if (!sheet) continue;
//
//         for (let j=0; j<sheet.cssRules.length; j++) {
//             let rule = /** @type {CSSStyleRule} */(sheet.cssRules[j]);
//             if (!rule) continue;
//             if (rule.type != rule.STYLE_RULE) continue;
//
//             for (let k=0; k<rule.style.length; k++) {
//                 let prop = rule.style[k];
//                 if (!prop) continue;
//                 if (!prop.startsWith("--")) continue;
//                 vars[prop.slice(2)] = rule.style.getPropertyValue(prop);
//             }
//         }
//     }
//     return vars;
// }
// const css_vars = get_css_vars();

/**
@arg {string} label
@arg {string} route
*/
function nav_item(label, route) {
    container("a");
        if (router.route_matches(route.slice(1), window.location.toString())) {
            cls("current");
        }
        attr("href", route);
        text(label);
    step_out();
}

function navigation() {
    container("div");
        container("h1"); cls("row"); style("margin-block: -4px")
            element("img");
                style("margin-block: -16px")
                attr("src", "assets/logo.svg");
                attr("width", 48);
            text("Odmah")
        step_out();

        container("nav");
            nav_item("Home", "#/");
            nav_item("ToDos", "#/todos");
            nav_item("Docs", "#/docs");
        step_out();
    step_out();
}

function what_is_immediate_mode() {
    html(`
        <h2>What is immediate mode?</h2>

        <p>In general, immediate-mode is an API design paradigm for building
            complex hierarchical structures. The distinctive feature of
            immediate-mode APIs is that individual objects that compose the
            hierarchical structure need not be tracked by the user of the API.
            From the user side, the entire hierarchy is rebuilt from scratch
            as needed - all of the state changes and tracking is either not
            performed, or it is performed behind the scenes, by the provider of
            the API.

        <p>More concretely, in UI terms, immediate-mode is a way of building UIs
            without the need for complex state management, event callbacks,
            object/element tracking, etc. The entire UI is built from scratch
            every frame via simple, top-to-bottom procedural code.

        <p>This also means that there is no separation between the view
            "template" and the UI logic, as is often observed in retained mode
            UI frameworks.

        <p>For example, here is a simple click counter in Svelte:

        <figcaption>Svelte</figcaption>
        <pre style="margin-bottom: 1em">${raw(`
            // Svelte
            <script>
                let count = $state(0);

                function increment() {
                    count += 1;
                }
            </script>

            <button onclick={increment}>
                clicks: {count}
            </button>
        `)}</pre>

        <p>And here is how the same thing would look in Odmah:

        <figcaption>Odmah</figcaption>
        <pre style="margin-bottom: 1em">${raw(`
            import { odmah, container, step_out, hook } from "odmah";

            let count = 0;
            odmah(() => {
                container("button");
                    if (hook("click")) count++;
                    text(\`clicks: \${count}\`);
                step_out();
            });
        `)}</pre>

        <p>Notice the absence of the <b>increment</b> function, and how the
            moment that the <b>count</b> variable is incremented in the
            normal top-to-bottom flow of the code. We simply ask the framework
            if the "click" event <i>happened</i> since the previous frame, and
            react to that information.

        <p>One other thing that arises naturally in immediate-mode APIs is that
            logic and view compose together in interesting ways:

        <figcaption>Odmah</figcaption>
        <pre style="margin-bottom: 1em">${raw(`
            import { odmah, container, step_out, hook } from "odmah";

            function button(label) {
                container("button");
                    text(label);
                step_out();

                if (hook("click")) {
                    request_rerender();
                    return true;
                }

                return false;
            }

            let count = 0;
            odmah(() => {
                if (button(\`clicks: \${count}\`)) count++;
                if (button("decrement")) count--;
            });
        `)}</pre>

        <p>Notice how, after extracting the button into a separate, reusable
            function, which returns if the button was clicked or not, we can now
            use the button in a very intuitive way - if the button is clicked,
            perform some action.

        <hr/>

        <p>That should be enough of an introduction to immediate-mode APIs and
            UIs. If you are interested in learning more, here are some good
            resources:

        <ul>
            <li><a href="https://caseymuratori.com/blog_0001">
                Casey Muratori: Immediate-Mode Graphical User Interfaces
            </a></li>

            <li><a href="https://www.rfleury.com/p/ui-part-2-build-it-every-frame-immediate">
                Ryan Fleury: Every Single Frame
            </a></li>

            <li><a href="https://github.com/ocornut/imgui/wiki/About-the-IMGUI-paradigm">
                Omar Cornut: About the IMGUI paradigm
            </a></li>
        </ul>
    `);
}

/**
@template T
@typedef {
    (() => Promise<T>) & {
        running?: boolean;
        result?: T;
    }
} AsyncFn
*/

/**
@template T
@arg {AsyncFn<T>} async_fn
@returns {T|undefined}
*/
function spinner(async_fn) {
    switch (async_fn.running) {
        case undefined:
            async_fn.running = true;
            let cursor = get_current_cursor();
            async_fn().then(res => {
                async_fn.result = res;
                async_fn.running = false;
                request_rerender(cursor);
            });

        case true:
            container("div"); text("Loading"); step_out();
        break;
    }
    return async_fn.result;
}

/**
@typedef {{
    odmah: string;
    html: string;
}} Visualization_Step
*/

/**
@arg {string} odmah
@arg {string[]} html
@returns {Visualization_Step[]}
*/
function viz_lines(odmah, ...html) {
    odmah = dedent(odmah);
    let steps = ["", ...odmah.split("\n")];
    return steps.map((odmah, i) => ({odmah, html: /** @type {string} */(html[i])}));
}

/** @arg {Visualization_Step[]} viz */
function visualization(viz) {
    container("div");
        let state = get_element_state();
        state["step"] ??= 0;

        container("div"); cls("column"); style("gap: 0; margin-bottom: 1em");

            container("figcaption"); cls("row");
                text("Code");

                if (button("⏮")) { state["step"]--; request_rerender() }
                if (state["step"] == 0) attr("disabled");

                if (button("⏭")) { state["step"]++; request_rerender() }
                if (state["step"] == viz.length-1) attr("disabled");

                if (state["step"] < 0) state["step"] = 0;
                if (state["step"] >= viz.length) state["step"] = viz.length-1;
            step_out();

            container("div"); cls("code-viz border-block");
                container("pre");
                for (let i=0; i<viz.length; i++) {
                    let step = /** @type {Visualization_Step} */(viz[i]);

                    container("span");
                        if (hook("click")) {
                            state["step"] = i;
                            request_rerender();
                        }

                        if (i == state["step"]) cls("current-step");
                        text(step.odmah);
                    step_out();
                    if (step.odmah) text("\n");
                }
                step_out();

                container("pre");
                    let code = /** @type {Visualization_Step} */(viz[state["step"]]).html;
                    code = code.replace("<-c", "🮰");
                    text(dedent(code));
                step_out();

            step_out();
            $text.figcaption("HTML");

        step_out();
    step_out();
}

const keywords = [
    "if", "for", "else", "let", "const", "function", "return", "async", "await"
];
const fwk_fns = [
    "container", "step_out", "element", "get_element_state", "hook", "attr",
    "style", "css", "cls", "text"
];

/** @arg {string} ch */
function is_ws(ch) {
    return ch == " " || ch == "\t" || ch == "\n" || ch == "\r";
}

const CHAR_0 = "0".charCodeAt(0);
const CHAR_9 = "9".charCodeAt(0);
/** @arg {string} ch */
function is_digit(ch) {
    let c = ch.charCodeAt(0);
    return c>=CHAR_0 && c<=CHAR_9;
}

const CHAR_a = "a".charCodeAt(0);
const CHAR_z = "z".charCodeAt(0);
const CHAR_A = "A".charCodeAt(0);
const CHAR_Z = "Z".charCodeAt(0);
const CHAR__ = "_".charCodeAt(0);
/** @arg {string} ch */
function is_ident_char(ch) {
    let c = ch.charCodeAt(0);
    return (
        (c>=CHAR_a && c<=CHAR_z) ||
        (c>=CHAR_A && c<=CHAR_Z) ||
        (c>=CHAR_0 && c<=CHAR_9) ||
        (c == CHAR__)
    );
}

const CHAR_sq = "'".charCodeAt(0);
const CHAR_dq = '"'.charCodeAt(0);
const CHAR_bt = "`".charCodeAt(0);
/** @arg {string} ch */
function is_quote(ch) {
    let c = ch.charCodeAt(0);
    return c == CHAR_sq || c == CHAR_dq || c == CHAR_bt;
}

/** @arg {string} code */
function tokenize_js(code) {
    /** @type {string[]} */
    let tokens = [];

    for (let i=0; i<code.length; i++) {
        let ch = code.charAt(i);

        if (is_ws(ch)) {
            let start = i;
            while (is_ws(code.charAt(i))) i++;
            tokens.push(code.slice(start, i));
            i--;
            continue;
        }

        if (is_digit(ch)) {
            let start = i;
            while (is_digit(code.charAt(i))) i++;
            tokens.push(code.slice(start, i));
            i--;
            continue;
        }

        if (is_ident_char(ch)) {
            let start = i;
            while (is_ident_char(code.charAt(i))) i++;
            tokens.push(code.slice(start, i));
            i--;
            continue;
        }

        if (is_quote(ch)) {
            let start = i;
            while (i<code.length && code.charAt(++i) != ch) {
                if (code.charAt(i) == "\\") { i++; }
            }
            tokens.push(code.slice(start, i+1));
            continue;
        }

        if (ch == "/" && code.charAt(i+1) == "/") {
            let start = i;
            while (i<code.length && code.charAt(i+1) != "\n") {
                i++;
            }
            tokens.push(code.slice(start, i+1));
            continue;
        }

        if (ch == "/" && code.charAt(i+1) == "*") {
            let start = i;
            while (i<code.length && !(code.charAt(i) == "/" && code.charAt(i-1) == "*")) {
                i++;
            }
            tokens.push(code.slice(start, i+1));
            continue;
        }

        tokens.push(ch);
    }
    return tokens;
}

/** @arg {Doc_Live} live */
function live_example(live) {
    container("div");
        container("div"); cls("column"); style("gap: 0; margin-bottom: 1em");

            container("figcaption"); cls("row");
                text("Code");
            step_out();

            container("div"); cls("doc-example border-block");
                html(live.code.outerHTML);

                container("div");
                    live.fn();
                step_out();

            step_out();
            $text.figcaption("Output");

        step_out();
    step_out();
}

/** @arg {string} str */
function slug(str) {
    return str
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9 _-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

const Doc = {
    /**
    @arg {string} title
    @arg {Doc_Part[]} contents
    @return {Doc_Section}
    */
    section(title, contents) {
        return { type: "section", title, slug: slug(title), contents };
    },

    /**
    @arg {string} name
    @arg {Record<string, string>} args
    @arg {string} returns
    @arg {Doc_Part[]} contents
    @return {Doc_Fn}
    */
    fn(name, args, returns, contents) {
        return { type: "function", name, slug: slug(name), args, returns, contents };
    },

    /**
    @arg {string} contents
    @return {Doc_Md}
    */
    md(contents) {
        return { type: "markdown", contents };
    },

    /**
    @arg {Visualization_Step[]} viz
    @return {Doc_Viz}
    */
    viz(viz) {
        return { type: "viz", viz };
    },

    /**
    @arg {() => void} fn
    @return {Doc_Live}
    */
    live(fn) {
        let code = fn.toString().split("\n").slice(1, -1).join("\n");
        let tokens = tokenize_js(dedent(code));

        let parent = document.createElement("div");
        let pre = document.createElement("pre");
        parent.append(pre);

        cursor_inert(
            () => {
                for (let token of tokens) {
                    if (keywords.includes(token)) {
                        $text.span(token);
                        style("color: var(--lightfg)");

                    } else if (fwk_fns.includes(token)) {
                        $text.span(token);
                        style("color: var(--yellow)");

                    } else if (is_quote(token)) {
                        $text.span(token);
                        style("color: var(--yellow)");

                    } else if (is_ident_char(token) || is_ws(token.charAt(0))) {
                        text(token);

                    } else if (token.startsWith("/*") && token.endsWith("*/")) {
                        $text.span(token);
                        style("color: var(--green)");

                    } else if (token.startsWith("//")) {
                        $text.span(token);
                        style("color: var(--green)");

                    } else {
                        $text.span(token);
                        style("color: var(--lightfg)");
                    }
                }
            }, pre
        ).render_loop();

        return {
            type: "live",
            fn,
            code: pre
        };
    },

    /**
    @arg {Doc_Part[]} target
    @return {Doc_TOC}
    */
    toc(target, section="") {
        return { type: "toc", headings: get_headings(target, section) };
    }
};

/**
@typedef {{
    type: "section";
    title: string;
    slug: string;
    contents: Doc_Part[];
}} Doc_Section

@typedef {{
    type: "function";
    name: string;
    slug: string;
    args: Record<string, string>;
    returns: string;
    contents: Doc_Part[];
}} Doc_Fn

@typedef {{
    type: "markdown";
    contents: string;
}} Doc_Md

@typedef {{
    type: "viz";
    viz: Visualization_Step[];
}} Doc_Viz

@typedef {{
    type: "live";
    fn: () => void;
    code: HTMLElement;
}} Doc_Live

@typedef {{
    type: "toc";
    headings: Heading[];
}} Doc_TOC

@typedef {Doc_Section|Doc_Fn|Doc_Md|Doc_Viz|Doc_TOC|Doc_Live} Doc_Part
*/

/** @arg {[name: string, type: string]} arg */
function arg_render(arg) {
    return `- *arg* ${arg[0]} ==${arg[1]}==`;
}

/** @arg {Record<string, string>} args */
function args_render(args) {
    return Object.entries(args).map(arg_render).join("\n");
}

/**
@typedef {{
    title: string;
    slug: string;
    subheadings: Heading[];
}} Heading
*/

/**
@arg {Doc_Part[]} contents
@returns {Heading[]}
*/
function get_headings(contents, section="") {
    /** @type {Heading[]} */
    let headings = [];

    for (let content of contents) {
        switch (content.type) {
            case "function": {
                let id = section ? section + "-" + content.slug : content.slug;
                headings.push({
                    title: content.name,
                    slug: id,
                    subheadings: []
                });
            } break;

            case "section":
                let id = section ? section + "-" + content.slug : content.slug;
                headings.push({
                    title: content.title,
                    slug: id,
                    subheadings: get_headings(content.contents, id)
                });
            break;
        }
    }

    return headings;
}

/**
@arg {Heading[]} headings
*/
function render_toc(headings) {
    container("ul"); cls("toc");
    for (let heading of headings) {
        container("li");
            $text.a(heading.title);
            attr("href", "#/docs#"+heading.slug);
            if (heading.subheadings.length) render_toc(heading.subheadings);
        step_out();
    }
    step_out();
}

/** @arg {Doc_Part[]} parts */
function doc_render(parts, section="") {
    for (let part of parts) {
        switch (part.type) {
            case "markdown":
                markdown(part.contents);
            break;

            case "section": {
                let id = section ? section + "-" + part.slug : part.slug;
                $text.h2(part.title);
                attr("id", id);
                doc_render(part.contents, id);
            } break;

            case "viz":
                visualization(part.viz);
            break;

            case "live":
                live_example(part);
            break;

            case "function": {
                let id = section ? section + "-" + part.slug : part.slug;
                container("h3");
                    attr("id", id);
                    $text.em("fn");
                    text(" " + part.name);
                step_out();

                let md = args_render(part.args);
                if (part.returns) {
                    md += `\n- *returns* ==${part.returns}==`;
                }

                markdown(md);
                doc_render(part.contents, section);
                element("hr");
            } break;

            case "toc":
                render_toc(part.headings);
            break;
        }
    }
}

/** @arg {Node} el */
function to_html(el, depth=0) {
    let indent = "  ".repeat(depth);

    if (el instanceof Text) {
        if (!el.previousSibling) {
            return `${indent}${el.data}`;
        }
        return `${el.data}`;
    }

    if (el instanceof Element) {
        let attrs = "";
        for (let attr of el.attributes) {
            attrs += " " + attr.name;
            if (attr.value) attrs += `="${attr.value}"`;
        }

        let out = `${indent}<${el.localName}${attrs}`;

        switch (el.localName) {
            case "input":
            case "img":
                out += "/>\n";
                return out;

            default:
                out += ">\n";
                for (let child of el.childNodes) {
                    out += to_html(child, depth+1);
                }

                if (el.childNodes.length) out += `\n`;
                out += `${indent}</${el.localName}>\n${indent}`;
            break;
        }

        return out;
    }

    throw new Error("Unexpected type");
}

/** @arg {string} text */
function remove_empty_lines(text) {
    return text.split("\n").filter(s=>!!s.length).join("\n");
}

/** @arg {string} src */
function vizmaker(src, initial_html="") {
    let lines = dedent(src).split("\n");
    if (lines[0] != "") lines.unshift("");

    /** @type {string[]} */
    let html = [];
    let parent = document.createElement("div");
    let target = document.createElement("div");
    parent.append(target);

    for (let step=0; step<lines.length; step++) {
        let code = lines.slice(0, step+1).join("\n");
        target.innerHTML = initial_html;

        cursor_inert(
            () => { eval(code); text("🮰") },
            target
        ).render_loop();

        let out = "";
        for (let child of target.childNodes) {
            out += to_html(child);
        }
        html.push(remove_empty_lines(out));
    }

    return viz_lines(src, ...html);
}

const doc_fn_container = Doc.fn(
    "container",
    {tag_name: "string", cursor: "Cursor ?"}, "Element",
    [
        Doc.md(`
            This function inserts an element at the current cursor position, and
            moves the cursor to the start of the element.
        `),

        Doc.viz(vizmaker(`
            container("div");
                text("Hello, world!");
            step_out();
        `)),

        Doc.md(`
            If an element with the requested tag already exists under the cursor,
            then the cursor is simply moved to the start of *that* element.
        `),

        Doc.viz(viz_lines(
            `
                container("div");
                    text("Hello, world!");
                step_out();
            `, `
                <-c
                <div>
                    Some other text.
                </div>
            `, `
                <div>
                    <-cSome other text.
                </div>
            `, `
                <div>
                    Hello, world!<-c
                </div>
            `, `
                <div>
                    Hello, world!
                </div>
                <-c
            `
        )),

        Doc.md(`
            By default, the currently active cursor will be used. A different
            cursor can optionally be passed.

            The function returns the element it just moved the cursor to. The
            exact type of the element depends on the \`tag_name\` argument.
        `)
    ]
);

const doc_fn_step_out = Doc.fn(
    "step_out",
    {cursor: "Cursor ?"}, "Element",
    [
        Doc.md(`
            This function moves the cursor outside of the element that it is
            currently in.
        `),

        Doc.viz(viz_lines(
            `step_out();`, `
                <div>
                    <-c
                </div>
            `, `
                <div>
                </div>
                <-c
            `
        )),

        Doc.md(`
            It returns the element that was just stepped outside of.
        `),

        Doc.viz(viz_lines(
            `
                let button = step_out();
                style("background: red", button);
            `, `
                <button>
                    <-c
                </button>
            `, `
                <button>
                </button>
                <-c
            `, `
                <button style="background: red">
                </button>
                <-c
            `
        )),

        Doc.md(`
            By default, the currently active cursor will be used. A different
            cursor can optionally be passed.
        `)
    ]
);

const doc_fn_text = Doc.fn(
    "text",
    {tag_name: "string", cursor: "Cursor ?"}, `Text`,
    [
        Doc.md(`
            This function inserts text at the cursor. The inserted
            [text node](${mdn("Web/API/Text")}) is returned.
        `),

        Doc.viz(vizmaker(`
            text("Hello, world!");
        `)),

        Doc.viz(vizmaker(`
            let text_node = text("Hello, world!");
            text_node.data = "Hello, sailor!";
        `))
    ]
);

const doc_fn_element = Doc.fn(
    "element",
    {tag_name: "string", cursor: "Cursor ?"}, "Element",
    [
        Doc.md(`
            This function is a shorthand for calling \`container\`, immediately
            followed by calling \`step_out\`.
        `),

        Doc.viz(vizmaker(`
            element("img");
            attr("src", "assets/logo.svg");
            attr("width", 100);
        `)),

        Doc.live(() => {
            element("img");
            attr("src", "assets/logo.svg");
            attr("width", 100);
        }),

    ]
);

const doc_fn_attr = Doc.fn(
    "attr",
    {name: "string", value: "any", element: "Element ?"}, "",
    [
        Doc.md(`
            This function sets an attribute on the provided element. If an
            element is not provided, it sets an attribute on the last element
            inserted by the current cursor.
        `),

        Doc.viz(vizmaker(`
            element("img");
            attr("src", "assets/logo.svg");
            attr("alt", "Odmah logo");
        `))
    ]
);

/** @arg {string} route */
function mdn(route) {
    return `https://developer.mozilla.org/en-US/docs/${route}`;
}

const doc_fn_get_attr = Doc.fn(
    "get_attr",
    {name: "string", element: "Element ?"}, "any",
    [
        Doc.md(`
            This function gets the current value of an attribute on the provided
            element. If an element is not provided, it operates on the last
            element inserted by the current cursor.
        `),

        Doc.viz(vizmaker(`
            container("div");
                attr("data-value", "10");
                let value = get_attr("data-value");
                text(\`The attribute is set to \${value}\`);
            step_out();
        `)),

        Doc.md(`
            **Note!**

            This function only works with attributes that are managed by odmah.
            If you are using a third party library that does not use odmah's
            core functions to add attributes to an element, then you can not use
            \`get_attr\` to get the values of these attributes. Instead, get the
            element and use the browser-native
            [\`element.getAttribute\`](${mdn("Web/API/Element/getAttribute")})
            method.
        `),

    ]
);

const doc_fn_style = Doc.fn(
    "style",
    {css: "string", element: "Element ?"}, "",
    [
        Doc.md(`
            This function appends a style to the provided element's inline
            styles. If an element is not provided, it operates on the last
            element inserted by the current cursor.
        `),

        Doc.viz(vizmaker(`
            element("input");
            style("background: black;");
            style("color: white;");
        `)),
    ]
);

const doc_fn_set_style = Doc.fn(
    "set_style",
    {css: "string", element: "Element ?"}, "",
    [
        Doc.md(`
            This function overrides the element's current inline style with a
            new one. If an element is not provided, it operates on the last
            element inserted by the current cursor.
        `),

        Doc.viz(vizmaker(`
            element("input");
            style("background: black;");
            style("color: yellow;");
            if (true) set_style("display: none;");
        `)),
    ]
);

const doc_fn_cls = Doc.fn(
    "cls",
    {class_name: "string", element: "Element ?"}, "",
    [
        Doc.md(`
            This function appends to the element's class list. If an element is
            not provided, it operates on the last element inserted by the
            current cursor.

            Multiple classes can be set in a single call to cls.
        `),

        Doc.viz(vizmaker(`
            container("div");
                cls("card bright");
            step_out();
        `)),
    ]
);

const doc_fn_hook = Doc.fn(
    "hook",
    {
        event: "string",
        target: "EventTarget ?",
        value_getter: "(e: Event) => T ?",
        cursor: "Cursor ?"
    }, "T | undefined",
    [
        Doc.md(`
            This function returns a value on the frame when the specified event
            is triggered. On frames when the event is not triggered, the
            function returns \`undefined\`.

            The returned value depends on the \`value_getter\` argument. If this
            argument is not provbided, the returned value will simply be \`true\`.

            The event target defaults to the last inserted element if not provided.
        `),

        Doc.md(`
            #### Examples
            The following example demonstrates simple handling of button clicks:
        `),

        Doc.live(() => {
            let state = get_element_state();
            state["count"] ??= 0;

            container("button");
                if (hook("click")) state["count"]++;
                text(`Clicked ${state["count"]} times.`);
            step_out();
        }),

        Doc.md(`
            Events carry useful data, which we can fetch by providing the
            \`value_getter\` argument:
        `),

        Doc.live(() => {
            let state = get_element_state();
            state["count"] ??= 0;

            container("div");
                let scroll = hook("wheel", (e) => {
                    e.preventDefault();
                    return e.deltaY;
                }) ?? 0;

                state["count"] -= scroll;
                text("Scroll: "+state["count"]);

            step_out();
        }),
    ]
);

const doc_fn_get_element_state = Doc.fn(
    "get_element_state",
    { element: "Element ?" }, "Record<string, any>",
    [
        Doc.md(`
            This function accesses state bound to an element. The state is
            persistent across rerenders.

            The first call this function is called for some element, an empty
            object is associated with that element. The same object will be
            returned the next time the function is called.
        `),

        Doc.live(() => {
            container("button");
                // Get state object
                let state = get_element_state();
                state["count"] ??= 0;

                if (hook("click")) state["count"]++;
                text(`Clicked: ${state["count"]} times`);
            step_out();
        }),
    ]
);

const core_fns = [
    doc_fn_container,
    doc_fn_text,
    doc_fn_step_out,
    doc_fn_element,
    doc_fn_attr,
    doc_fn_get_attr,
    doc_fn_style,
    doc_fn_set_style,
    doc_fn_cls,
    doc_fn_hook,
    doc_fn_get_element_state,
];

const docs_core = Doc.section("Core", [
    Doc.md(`
        These are basic functions for building the view.
    `),
    Doc.toc(core_fns, "core"),
    Doc.md(`---`),
    ...core_fns
]);

function docs() {
    container("article"); cls("doc");

    doc_render([ docs_core ]);

    step_out();
}

/** @type {Record<string, Doc_Live>} */
const simple_examples = {
    "Hello, world!": Doc.live(() => {
        container("p");
            text("Hello, world!");
        step_out();
    }),

    "Button": Doc.live(() => {
        container("button");
            text("Please, click me");
            if (hook("click")) {
                alert("The button was clicked!");
            }
        step_out();
    }),

    "Ticker": Doc.live(() => {
        let cursor = get_current_cursor();
        let state = get_element_state();

        if (state["tick"] == undefined) {
            setInterval(() => {
                if (example == "Ticker") {
                    state["tick"]++;
                    request_rerender(cursor);
                }
            }, 1000);
        }

        state["tick"] = state["tick"] ?? 0;

        container("p");
            text(`${state["tick"]} ticks have passed.`);
        step_out();
    }),

    "Counter": Doc.live(() => {
        let state = get_element_state();
        state["count"] = state["count"] ?? 0;
        container("button");
            if (hook("click")) state["count"]++;
            text(`Clicked: ${state["count"]} times`);
        step_out();
    }),

    "Local Storage": Doc.live(() => {
        /** @arg {string} key */
        function get_ls(key) {
            let value = localStorage.getItem(key);
            let storage_value = hook("storage", (e) => {
                if (e.storageArea != localStorage) return;
                if (e.key != key) return;
                return e.newValue;
            }, window);
            value = storage_value ?? value;
            return value;
        }

        /** @arg {string} key @arg {string} value */
        function set_ls(key, value) {
            localStorage.setItem(key, value);
        }

        container("div"); cls("column");
            container("p");
                text(
                    "The text you enter below " +
                    "will be saved to localStorage."
                );
            step_out();

            /** @type {string|null} */
            let message = get_ls("message") ?? "";
            let input = element("input");
            if (hook("input")) {
                message = input.value;
                set_ls("message", message);
            } else {
                input.value = message;
            }
        step_out();
    })
};

let example = "Hello, world!";
function welcome() {
    container_id("div#welcome"); cls("column");
        html(`
            <p>The <a href="#/what-is-immediate-mode">immediate-mode</a>
                javascript framework!

            <p>Check out the simple examples below, or the more involved ones in
                the navigation above.

            <p>Please keep in mind that the entire API surface is experimental
                and subject to change.
        `);

        container("div"); cls("row"); style("margin-top: 2em");
            element("div"); cls("flex-dynamic"); style("background: currentColor; height: 1px");
            example = select.begin(example); style("width: 20ch")
                for (let option in simple_examples) select.option(option);
            select.end();
            element("div"); cls("flex-dynamic"); style("background: currentColor; height: 1px");
        step_out();

        let ex = /** @type {Doc_Live} */(simple_examples[example]);
        live_example(ex);
    step_out();
}

const router = create_router({hash: true});
function examples() {
    router.route("/", welcome);
    router.route("/what-is-immediate-mode", what_is_immediate_mode);
    router.route("/docs", docs);
    register_todos(router);

    odmah(() => {
        navigation();
        router.current_route();
    });
}

examples();
