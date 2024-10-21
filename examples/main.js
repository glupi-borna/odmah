"use strict"

import { odmah, container, step_out, text, attr, style, cls, hook, element, get_element_state, get_current_cursor, request_rerender } from "../odmah.js";
import { $text, select, html, raw } from "./shared.js";
import { create_router } from "../modules/routing.js";
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
    container("div", "navigation");
        container("h1");
            text("Odmah")
        step_out();

        container("nav");
            nav_item("Home", "#/");
            nav_item("ToDos", "#/todos");
        step_out();
    step_out();
}

/** @type {Record<string, () => void>} */
const simple_examples = {
    "Hello, world!": () => {
        container("p");
            text("Hello, world!");
        step_out();
    },

    "Button": () => {
        container("button");
            text("Please, click me");
            if (hook("click")) {
                alert("The button was clicked!");
            }
        step_out();
    },

    "Ticker": () => {
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
    },

    "Counter": () => {
        let state = get_element_state();
        state["count"] = state["count"] ?? 0;
        container("button");
            if (hook("click")) state["count"]++;
            text(`Clicked: ${state["count"]} times`);
        step_out();
    },

    "Local Storage": () => {
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
    }
};

let example = "Hello, world!";
function welcome() {
    container("div"); cls("column");
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

        container("div"); cls("column"); style("gap: 0");
            $text.figcaption("Code");
            container("div"); cls("code-example border-block");
                let example_fn = /** @type {() => void} */(simple_examples[example]);
                $text.pre(example_fn.toString().split("\n").slice(1,-1).join("\n"));

                container("div");
                    example_fn();
                step_out();
            step_out();
            $text.figcaption("Result");
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

const router = create_router({hash: true});
function examples() {
    router.route("/", welcome);
    router.route("/what-is-immediate-mode", what_is_immediate_mode);
    register_todos(router);

    odmah(() => {
        navigation();
        router.current_route();
    });
}

examples();
