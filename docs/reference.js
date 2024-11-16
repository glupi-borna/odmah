import { Doc, vizmaker, viz_lines, doc_render } from "./shared.js";
import { element, attr, get_element_state, container, hook, text, step_out, cls } from "../odmah.js";

/**
@arg {string} text
@arg {string} route
*/
function mdn(text, route) {
    return `<a href="https://developer.mozilla.org/en-US/docs/${route}">${text}</a>`;
}

const doc_fn_container = Doc.fn(
    "container",
    {tag_name: "string", cursor: "Cursor ?"}, "Element",
    [
        Doc.html(`
            <p>This function inserts an element at the current cursor position, and
            moves the cursor to the start of the element.
        `),

        Doc.viz(vizmaker(`
            container("div");
                text("Hello, world!");
            step_out();
        `)),

        Doc.html(`
            <p>If an element with the requested tag already exists under the cursor,
            then the cursor is simply moved to the start of <em>that</em> element.
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

        Doc.html(`
            <p>By default, the currently active cursor will be used. A different
            cursor can optionally be passed.

            <p>The function returns the element it just moved the cursor to. The
            exact type of the element depends on the <code>tag_name</code> argument.
        `)
    ]
);

const doc_fn_step_out = Doc.fn(
    "step_out",
    {cursor: "Cursor ?"}, "Element",
    [
        Doc.html(`
            <p>This function moves the cursor outside of the element that it is
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

        Doc.html(`
            <p>It returns the element that was just stepped outside of.
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

        Doc.html(`
            <p>By default, the currently active cursor will be used. A different
            cursor can optionally be passed.
        `)
    ]
);

const doc_fn_text = Doc.fn(
    "text",
    {tag_name: "string", cursor: "Cursor ?"}, `Text`,
    [
        Doc.html(`
            <p>This function inserts text at the cursor. The inserted
            ${mdn("text node", "Web/API/Text")} is returned.
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
        Doc.html(`
            <p>This function is a shorthand for calling <code>container</code>,
            immediately followed by calling <code>step_out</code>.
        `),

        Doc.viz(vizmaker(`
            element("img");
            attr("src", "assets/logo.svg");
            attr("width", 100); attr("height", 100);
            attr("alt", "Odmah logo");
        `)),

        Doc.live(() => {
            element("img");
            attr("src", "assets/logo.svg");
            attr("width", 100); attr("height", 100);
            attr("alt", "Odmah logo");
        }),

    ]
);

const doc_fn_attr = Doc.fn(
    "attr",
    {name: "string", value: "any", element: "Element ?"}, "",
    [
        Doc.html(`
            <p>This function sets an attribute on the provided element. If an
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

const mdn_getattr = mdn("element.getAttribute", "Web/API/Element/getAttribute");
const doc_fn_get_attr = Doc.fn(
    "get_attr",
    {name: "string", element: "Element ?"}, "any",
    [
        Doc.html(`
            <p>This function gets the current value of an attribute on the
            provided element. If an element is not provided, it operates on the
            last element inserted by the current cursor.
        `),

        Doc.viz(vizmaker(`
            container("div");
                attr("data-value", "10");
                let value = get_attr("data-value");
                text(\`The attribute is set to \${value}\`);
            step_out();
        `)),

        Doc.html(`
            <p><strong>Note!</strong>

            <p>This function only works with attributes that are managed by odmah.
            If you are using a third party library that does not use odmah's
            core functions to add attributes to an element, then you can not use
            <code>get_attr</code> to get the values of these attributes. Instead,
            get the element and use the ${mdn_getattr} method.
        `),

    ]
);

const doc_fn_style = Doc.fn(
    "style",
    {css: "string", element: "Element ?"}, "",
    [
        Doc.html(`
            <p>This function appends a style to the provided element's inline
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
        Doc.html(`
            <p>This function overrides the element's current inline style with a
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
        Doc.html(`
            <p>This function appends to the element's class list. If an element is
            not provided, it operates on the last element inserted by the
            current cursor.

            <p>Multiple classes can be set in a single call to <code>cls</code>.
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
        Doc.html(`
            <p>This function returns a value on the frame when the specified
            event is triggered. On frames when the event is not triggered, the
            function returns <code>undefined</code>.

            <p>The returned value depends on the <code>value_getter</code>
            argument. If this argument is not provbided, the returned value will
            simply be <code>true</code>.

            <p>The event target defaults to the last inserted element if not
            provided.

            <p><strong>Note!</strong>
            <p>The <code>target</code> and <code>value_getter</code> arguments
            can be provided in any order!

            <h4>Examples</h4>
            <p>The following example demonstrates simple button click handling:
        `),

        Doc.live(() => {
            let state = get_element_state();
            state["count"] ??= 0;

            container("button");
                if (hook("click")) state["count"]++;
                text(`Clicked ${state["count"]} times.`);
            step_out();
        }),

        Doc.html(`
            <p>Events contain useful data, which we can get by providing the
            <code>value_getter</code> argument:
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
        Doc.html(`
            <p>This function accesses state bound to an element. The state is
            persistent across rerenders.

            <p>The first call this function is called for some element, an empty
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
    Doc.html(`
        <p>These are basic functions for building the view.
    `),
    Doc.toc(core_fns, "core"),
    Doc.html(`<hr />`),
    ...core_fns
]);

export function docs() {
    container("article"); cls("doc");
    doc_render([ docs_core ]);
    step_out();
}
