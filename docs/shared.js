import { element, container, step_out, text, attr, hook, cursor_inert, cls, style, get_element_state, request_rerender } from "../odmah.js";
import * as $ from "../odmah.js";
import { tokenize_js, keywords, fwk_fns, is_quote, is_ident_char, is_ws } from "./js_tokenizer.js";
import { dedent, html } from "../modules/utils.js";

for (let key in $) {
    // @ts-ignore
    window[key] = $[key];
}

/**
@example
$text.pre(`This is some preformatted text`);
$text.p(`This is a paragraph`);
$text.span(`This is a span`);
$text.figcaption(`This is a figcaption`);
*/
export const $text = new Proxy(/** @type {Record<keyof HTMLElementTagNameMap, (text: string) => void>} */({}), {
    /**
    @arg {keyof HTMLElementTagNameMap} element
    */
    get(_, element) {
        /** @arg {string} content */
        return function (content) {
            container(element);
                text(dedent(content));
            step_out();
        };
    }
});

/**
@arg {string} value
@example
text = string_input(text);
*/
export function string_input(value) {
    let input = element("input");
    if (hook("input")) {
        value = input.value;
    } else {
        input.value = value;
    }
    return value;
}

/**
@arg {boolean} value
@example
some_boolean = checkbox(some_boolean);
*/
export function checkbox(value) {
    value = !!value;
    let input = element("input"); attr("type", "checkbox");
    if (hook("input")) {
        value = input.checked;
    } else {
        input.checked = value;
    }
    return value;
}

/**
@example
value = select.begin(value);
    for (let option of options) select.option(option);
select.end();
*/
export const select = {
    /** @arg {string} value */
    begin(value) {
        let el = container("select");
        if (hook("change")) value = el.value;
        else if (el.value != value) queueMicrotask(() => el.value = value);
        return value;
    },

    end() {
        step_out();
    },

    /** @arg {string} value */
    option(value) {
        $text.option(value);
    }
};

/**
@arg {string} label
@example
if (button("Please click me")) {
    console.log("THANK YOU!");
}
*/
export function button(label) {
    container("button");
        text(label);
    step_out();
    return hook("click");
}

/**
@example
if (button_begin()) {
    loading = true;
    get_data().then(() => loading = false);
}
    if (!loading) {
        my_icon_component("some-icon");
        container("span"); text("Hello, world!"); step_out();
    } else {
        my_spinner_component();
    }
button_end();
*/
export function button_begin() {
    container("button");
    return !!hook("click");
}

/**
@example
if (button_begin()) {
    loading = true;
    get_data().then(() => loading = false);
}
    if (!loading) {
        my_icon_component("some-icon");
        container("span"); text("Hello, world!"); step_out();
    } else {
        my_spinner_component();
    }
button_end();
*/
export function button_end() {
    let button = step_out();
    return !!hook("click", button);
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
    type: "html";
    contents: string;
}} Doc_HTML

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

@typedef {Doc_Section|Doc_Fn|Doc_HTML|Doc_Viz|Doc_TOC|Doc_Live} Doc_Part
*/

export const Doc = /** @type {const} */{
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
    @return {Doc_HTML}
    */
    html(contents) {
        return { type: "html", contents };
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

/** @arg {Doc_Part[]} parts */
export function doc_render(parts, section="") {
    for (let part of parts) {
        switch (part.type) {
            case "html":
                html(part.contents);
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

                let signature = "";
                signature += args_render(part.args);
                if (part.returns) {
                    signature += `<li><em>returns</em> <mark>${part.returns}</mark></li>`;
                }
                if (signature) signature = "<ul>" + signature + "</ul>";

                html(signature);
                doc_render(part.contents, section);
                element("hr");
            } break;

            case "toc":
                render_toc(part.headings);
            break;
        }
    }
}

/** @arg {[name: string, type: string]} arg */
function arg_render(arg) {
    return `<li><em>arg</em> ${arg[0]} <mark>${arg[1]}</mark></li>`
}

/** @arg {Record<string, string>} args */
function args_render(args) {
    return Object.entries(args).map(arg_render).join("");
}

/** @arg {string} text */
function remove_empty_lines(text) {
    return text.split("\n").filter(s=>!!s.length).join("\n");
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
export function viz_lines(odmah, ...html) {
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

/** @arg {string} src */
export function vizmaker(src, initial_html="") {
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

/** @arg {Doc_Live} live */
export function live_example(live) {
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

