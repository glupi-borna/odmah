"use strict"

import {
    odmah, container, step_out, element, text, style, css, attr, hook,
    request_rerender, mark_removed, get_current_cursor, get_element_state
} from "./odmah.js";
import { assert, cast_defined } from "./modules/debug.js";
import { button, input_string, checkbox } from "./modules/components.js";
import { hovered } from "./modules/mouse_utils.js";
import { timer_begin, timer_end, timer_stats } from "./modules/timing.js";

let count = 0;

/**
@template {keyof HTMLElementTagNameMap} T
@arg {T} tagname
*/
function text_element_fn(tagname) {
    /** @arg {...any} txt */
    return function(...txt) {
        const e = container(tagname);
        for (let i=0; i<txt.length; i++) {
            const t = txt[i];
            if (t != null) text(t);
        }
        step_out();
        return e;
    }
}

const p = text_element_fn("div");
const h1 = text_element_fn("h1");
const pre = text_element_fn("pre");
const summary = text_element_fn("summary");

function stats() {
    const stats = timer_stats();
    const keys = /** @type {(keyof typeof stats)[]} */(Object.keys(stats));
    container("details");
        summary("Frame time stats (for last 100 frames)");
        for (const key of keys) {
            p(key, ": ", stats[key]+"", "ms");
        }
    step_out();
}

function counter() {
    if (button("+1")) {
        count++;
    }
    style(`
        background: ${count%2?"red":"blue"};
        color: white;
    `);
    if (hovered()) {
        style(`
            background: yellow;
            color: black;
        `);
    }
    p(count+"", count%2==0 ? " is even" : null);
}

function button_counter() {
    let div = container("div"); style(`
        display: flex;
        column-gap: 1em;
    `);
        if (button("+1")) {
            count++;
        }

        if (button("-1")) {
            count--;
            mark_removed(/** @type {Element} */(div.lastChild));
        }

        if (button("/2")) {
            count = Math.floor(count/2);
        }

        if (count % 2 == 0) {
            if (button("+2")) {
                count += 2;
            }
        }

        if (button("x10")) count *= 10;
        if (button("10 000")) count = 10000;
    step_out();
    p("Count: ", count+"");

    container("div");
        text("The buttons:");
    step_out();

    container("div"); css(`
        @this {
            display: flex;
            min-width: 90vw;
            flex-flow: row wrap;

            button {
                color: white;
                background: blue;
                &:nth-child(even) { background: red };
                &:hover {
                    background: yellow;
                    color: black;
                }
            }
        }
    `);

    for (let i=0; i<count; i++) {
        if (button("Button " + i)) {
            alert(`Clicked button ${i}`);
        }

        attr("data-idx", i);
        if (i%5==0) {
            attr("disabled");
            attr("title", "This button is divisible by 5");
        }
    }
    step_out();
}

async function get_data() {
    let res = await fetch("https://jsonplaceholder.typicode.com/todos");
    /** @type {Record<string, any>[]} */
    let data = await res.json();
    return data;
}

/**
@template T
@template DEFAULT
@typedef {
    ({ state: "loading", data: T|DEFAULT } |
    { state: "done", data: T } |
    { state: "error", data: T|DEFAULT, error: any })
    & { load(get_data: () => Promise<T>): void }
} Sync_Data
*/

/**
@template T
@template [DEFAULT=null]
@arg {() => Promise<T>} get_data
@arg {DEFAULT} default_value
@return {Sync_Data<T, DEFAULT>}
*/
function sync(
    get_data,
    // @ts-ignore
    default_value=null,
    cursor=get_current_cursor()
) {
    let state = get_element_state(cursor.last_element);

    /** @type {Sync_Data<T, DEFAULT>} */
    let sync_data;
    if ("sync_data" in state) {
        sync_data = state["sync_data"];
    } else {
        sync_data = { state: "loading", load, data: default_value };
        state["sync_data"] = sync_data;

        /** @arg {() => Promise<T>} get_data */
        function load(get_data) {
            sync_data.state = "loading";
            get_data().then(res => {
                sync_data.state = "done";
                if (sync_data.state == "done") sync_data.data = res;
            }).catch(err => {
                sync_data.state = "error";
                if (sync_data.state == "error") sync_data.error = err;
            }).finally(() => request_rerender(cursor));
        }

        load(get_data);
    }

    return sync_data;
}

function editable_table() {
    let request = sync(get_data, []);

    let columns = /** @type {string[]} */([]);
    if (request.data.length) {
        columns = Object.keys(cast_defined("Table data item", request.data[0]));
    }

    let input = element("input");
    input.placeholder = "Search...";
    hook("input");
    const search = input.value;

    container("table"); // style(`border-collapse: collapse`);
        css(`
            @this {
                border-collapse: collapse;
                tr { background-color: #ccc }
                tr:nth-child(odd) { background-color: #eee }
            }
        `)

        container("tr");
            for (let key of columns) {
                container("th")
                    text(key);
                step_out();
            }
            container("th"); step_out();
        step_out();

        let to_delete = -1;
        let idx = 0;
        for (let i=0; i<request.data.length; i++) {
            let item = cast_defined("Table item", request.data[i]);
            if (!item["title"].includes(search)) continue;
            idx++;

            let tr = container("tr"); // style(`background-color: ${idx%2?"#ccc":"#eee"}`);
                for (let key of columns) {
                    container("td");
                    switch (typeof item[key]) {
                        case "string": {
                            item[key] = textbox(item[key]);
                        } break;

                        case "boolean": {
                            item[key] = checkbox(item[key]);
                        } break;

                        default: {
                            text(item[key] + "");
                        } break;
                    }
                    step_out();
                }

                container("td");
                    if (button("log")) {
                        console.log(item);
                    }

                    if (button("delete")) {
                        to_delete = i;
                        mark_removed(tr);
                        request_rerender();
                    }
                step_out();
            step_out();
        }
    step_out();

    if (to_delete >= 0) {
        request.data.splice(to_delete, 1);
    }
}

function double_hook() {
    container("button");
        text("Both of the below hooks should return true on click (refer to the code)");
    step_out();
    // hook1 and hook2 are attached to the same button,
    // so they should return the same value
    let hook1 = hook("click");
    let hook2 = hook("click");
    p(hook1 ? 'true' : 'false');
    p(hook2 ? 'true' : 'false');
}

/** @arg {string} value */
function textbox(value, disabled=false) {
    let input = element("input");
    input.disabled = disabled;
    if (hook("input")) {
        value = input.value;
    }
    input.value = value;
    return value;
}

let user = {
    first_name: "",
    last_name: "",
    is_disabled: false
};

function inputs() {
    container("div"); style(`
        display: flex;
        flex-direction: column;
        align-items: start;
        gap: .25em;
    `);
        user.is_disabled = checkbox(user.is_disabled);
        user.first_name = textbox(user.first_name, user.is_disabled);
        user.last_name = textbox(user.last_name, user.is_disabled);
    step_out();

    p("First name ", user.first_name);
    p("Last name ", user.last_name);
    p(JSON.stringify(user));
}

let examples = {
    todo,
    counter,
    button_counter,
    editable_table,
    double_hook,
    inputs,
};

/**
@template T
@arg {T} value
@arg {Record<string, T>} options
*/
function select(value, options) {
    assert(Object.values(options).includes(value), "Value not in options");

    /** @type {string|undefined} */
    let current = undefined;
    let s = container("select");
    if (hook("change")) value = /** @type {T} */(options[s.value]);
    for (let key in options) {
        container("option");
            if (options[key] == value) current = key;
            text(key);
        step_out();
    }
    step_out();
    s.value = cast_defined("Current select value", current);
    return value;
}

function todo() {
    let element_state = get_element_state();
    if (!("todo" in element_state)) {
        element_state["todo"] = {
            todos: [{ title: "Hello, world!", done: false }],
            next_title: ""
        };
    }

    let todo = element_state["todo"];
    todo.next_title = input_string(todo.next_title);

    if (button("CREATE TODO")) {
        todo.todos.push({
            title: todo.next_title,
            done: false
        });
        todo.next_title = "";
        request_rerender();
    }
    if (todo.next_title.length == 0) attr("disabled");

    p(`Current frame: ${get_current_cursor().current_frame}`);

    container("div");
    for (let i=0; i<todo.todos.length; i++) {
        let item = todo.todos[i];

        let el = container("div")
            if (item.done) style("text-decoration: line-through");
            item.done = checkbox(item.done);
            text(item.title);

            if (item.done) {
                if (button("Delete")) {
                    todo.todos.splice(i, 1);
                    mark_removed(el);
                    i--;
                }
            }
        step_out();
    }
    step_out();

    container("pre");
        text("State\n");
        text(JSON.stringify(todo, null, 2));
    step_out();
}

function col_start() {
    container("div"); style(`
        display: flex;
        flex-flow: column;
    `);
}

const end = step_out;

window.onload = function() {
    let unlocked = false;
    let example = todo;

    odmah(function() {
        timer_begin();

        stats();

        col_start(); {
            style("align-items: start");
            container("label");
                unlocked = checkbox(unlocked);
                text("Brrrr");
            step_out();

            if (unlocked) request_rerender();

            let old = example;
            example = select(example, examples);
            if (old != example) mark_removed(old.name)

            h1(example.name);
        }; end();

        container("details"); style(`
            background-color: black;
            color: white;
            padding: .5em;
            max-height: 33vh;
            overflow-y: auto;
        `);
            summary("Source");
            pre(example);
            style("font-size: 1rem;");
        step_out();

        container("div", example.name);
            example();
        step_out();

        timer_end();
    });
}
