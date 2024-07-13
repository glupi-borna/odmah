"use strict"

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

// p is a div because p elements have margins which need to be disabled and I am
// legally obliged not to write css.
const p = text_element_fn("div");
const h1 = text_element_fn("h1");
const pre = text_element_fn("pre");
const summary = text_element_fn("summary");

function stats() {
    const stats = frame_time_stats();
    const keys = /** @type {(keyof typeof stats)[]} */(Object.keys(stats));
    container("details");
        summary("Frame time stats (for last 1000 frames)");
        for (const key of keys) {
            p(key, ": ", stats[key]+"", "ms");
        }
    step_out();
}

function counter() {
    if (Button("+1")) {
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
        if (Button("+1")) {
            count++;
        }

        if (Button("-1")) {
            count--;
            mark_removed(/** @type {Element} */(div.lastChild));
        }

        if (Button("/2")) {
            count = Math.floor(count/2);
        }

        if (count % 2 == 0) {
            if (Button("+2")) {
                count += 2;
            }
        }

        if (Button("x10")) count *= 10;
        if (Button("10 000")) count = 10000;
    step_out();
    p("Count: ", count+"");

    container("div");
        text("The buttons:");
    step_out();

    container("div"); style(`
        display: flex;
        max-width: 90vw;
        flex-flow: row wrap;
    `);
    for (let i=0; i<count; i++) {
        if (Button("Button " + i)) {
            alert(`Clicked button ${i}`);
        }
        attr("data-idx", i);
        if (i%5==0) {
            attr("disabled");
            attr("title", "This button is divisible by 5");
        }
        style(`
            background-color: ${i%2?"red":"blue"};
            color: white;
        `);
        if (hovered()) {
            style(`
                background-color: yellow;
                color: black;
            `);
        }
    }
    step_out();
}

/** @type {Record<string, any>[]|null} */
let data = null;
/** @type {string[]} */
let columns = [];

async function get_data() {
    let res = await fetch("https://jsonplaceholder.typicode.com/todos");
    /** @type {Record<string, any>[]} */
    let data = await res.json();
    return data;
}

function editable_table() {
    if (data == null) {
        data = [];
        get_data().then(d => {
            data = d;
            columns = Object.keys(cast_defined("Table data item", data[0]));
            request_rerender();
        });
    }

    let input = element("input");
    input.placeholder = "Search...";
    hook("input");
    const search = input.value;

    container("table"); style(`border-collapse: collapse`);
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
        for (let i=0; i<data.length; i++) {
            let item = cast_defined("Table item", data[i]);
            if (!item["title"].includes(search)) continue;
            idx++;

            let tr = container("tr"); style(`background-color: ${idx%2?"#ccc":"#eee"}`);
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
                    if (Button("log")) {
                        console.log(item);
                    }

                    if (Button("delete")) {
                        to_delete = i;
                        // NOTE: mark_removed will *always* imply a
                        // request_rerender, so maybe it could call it
                        // automatically?
                        mark_removed(tr);
                        request_rerender();
                    }
                step_out();
            step_out();
        }
    step_out();

    if (to_delete >= 0) {
        data.splice(to_delete, 1);
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

/** @arg {boolean} checked */
function checkbox(checked) {
    let input = element("input");
    input.type = "checkbox";
    if (hook("input")) {
        checked = input.checked;
    }
    input.checked = checked;
    return checked;
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

let ok = true;
function conditional_step_in_out() {
    if (Button("x")) {
        ok = !ok;
    }

    p("Value: ", ok ? 'true' : 'false');

    element("div"); // @TODO: This does not work!
    if (ok) {
        step_in();
        text("This text should disappear when 'false'")
        step_out();
    }
}

let examples = {
    counter,
    button_counter,
    editable_table,
    double_hook,
    inputs,
    conditional_step_in_out,
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

function row_start() {
    container("div"); style(`
        display: flex;
        flex-flow: row;
    `);
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
    let example = counter;

    odmah(function() {
        if (hook("keydown")) {
            request_rerender();
        }

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
    });
}
