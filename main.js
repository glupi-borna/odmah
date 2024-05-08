let count = 0;

function wrapped_text(tagname, ...txt) {
    element(tagname);
    step_in();
    for (let i=0; i<txt.length; i++) {
        let t = txt[i];
        if (t) text(t);
    }
    step_out();
}

// p is a div because p elements have margins which need to be disabled and I am
// legally obliged not to write css.
const p = wrapped_text.bind(null, "div");
const legend = wrapped_text.bind(null, "legend");
const h1 = wrapped_text.bind(null, "h1");
const pre = wrapped_text.bind(null, "pre");
const summary = wrapped_text.bind(null, "summary");

function stats() {
    let stats = frame_time_stats();
    element("fieldset");
    step_in();
        legend("Frame time stats (for last 1000 frames)");
        for (let key in stats) {
            p(key, ": ", stats[key]+"", "ms");
        }
    step_out();
}

let hover = false;
function counter() {
    if (Button("+1")) {
        count++;
    }
    style("background", count%2?"red":"blue");
    style("color", "white");
    if (hook("mouseover")) hover = true;
    if (hook("mouseout")) hover = false;
    if (hover) {
        style("background", "yellow");
        style("color", "black");
    }
    p(count+"", count%2==0 ? " is even" : null);
}

let hovers = new Array(10000).fill(false);
function button_counter() {
    let div = element("div");
    style("display", "flex");
    style("column-gap", "1em");
    step_in();
        if (Button("+1")) {
            count++;
        }

        if (Button("-1")) {
            count--;
            mark_removed(div.lastChild);
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

    element("div");
    step_in();
        text("The buttons:");
    step_out();

    element("div");
    step_in();
    style("display", "flex");
    style("max-width", "90vw");
    style("flex-flow", "row wrap");
    for (let i=0; i<count; i++) {
        element("div");
        step_in();
            if (Button("Button " + i)) {
                alert(`Clicked button ${i}`);
            }

            style("background-color", i%2?"red":"blue");
            style("color", "white");
            if (hook("mouseover")) hovers[i] = true;
            if (hook("mouseout")) hovers[i] = false;
            if (hovers[i]) {
                style("background-color", "yellow");
                style("color", "black");
            }

        step_out();
    }
    step_out();
}

let data = null;
let columns = [];

async function get_data() {
    let res = await fetch("https://jsonplaceholder.typicode.com/todos");
    return await res.json();
}

function editable_table() {
    if (data == null) {
        data = [];
        get_data().then(d => {
            data = d;
            columns = Object.keys(data[0]);
            request_rerender();
        });
    }

    let input = element("input");
    input.placeholder = "Search...";
    hook("input");
    const search = input.value;

    element("table");
    style("border-collapse", "collapse");
    step_in();
        element("tr");
        step_in();
            for (let key of columns) {
                element("th")
                step_in();
                    text(key);
                step_out();
            }
            element("th");
        step_out();

        let to_delete = -1;
        let idx = 0;
        for (let i=0; i<data.length; i++) {
            let item = data[i];
            if (!item.title.includes(search)) continue;
            idx++;

            let tr = element("tr");
            style("background-color", idx%2?'#ccc':'#eee');
            step_in();
                for (let key of columns) {
                    element("td")
                    step_in();
                        switch (typeof item[key]) {
                            case "string": {
                                let input = element("input");
                                let changed = hook("input");
                                if (changed) {
                                    item[key] = input.value;
                                }
                                input.value = item[key];
                            } break;

                            case "boolean": {
                                let input = element("input");
                                let changed = hook("input");
                                if (changed) {
                                    item[key] = input.checked;
                                }
                                input.type = "checkbox";
                                input.checked = item[key];
                            } break;

                            default: {
                                text(item[key] + "");
                            } break;
                        }
                    step_out();
                }

                element("td");
                step_in();
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
    // This used to not work, but now it does.
    element("button");
    step_in();
        text("Both of the below hooks should return true on click (refer to the code)");
    step_out();
    // hook1 and hook2 are attached to the same button, so they should return
    // the same value
    let hook1 = hook("click");
    let hook2 = hook("click");
    p(hook1 ? 'true' : 'false');
    p(hook2 ? 'true' : 'false');
}

function checkbox(checked) {
    let input = element("input");
    input.type = "checkbox";
    if (hook("input")) {
        checked = input.checked;
    }
    input.checked = checked;
    return checked;
}

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
    element("div");
    step_in();
        style("display", "flex");
        style("flex-direction", "column");
        style("align-items", "start");
        style("gap", ".25em");
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

    element("div");
    if (ok) {
        step_in();
        text("This text should disappear when 'false'")
        step_out();
    }
}

let examples = { counter, button_counter, editable_table, double_hook, inputs, conditional_step_in_out };

window.onload = function() {
    let unlocked = false;
    let example = conditional_step_in_out;

    odmah(function() {
        if (hook("keydown")) {
            request_rerender();
        }

        stats();

        if (Button(unlocked ? "Dirty flag optimisation" : "Brrrrr")) {
            unlocked = !unlocked;
            request_rerender();
        }

        if (unlocked) {
            request_rerender();
        }

        let example_changed = false;
        let s = element("select");
        if (hook("change")) {
            example = examples[s.value];
            example_changed = true;
        }
        step_in();
            for (let name in examples) {
                element("option");
                step_in();
                    text(name);
                step_out();
            }
        step_out();
        s.value = example.name;

        h1(example.name);

        element("details");
        style("background-color", "black");
        style("color", "white");
        style("padding", ".5em");
        style("overflow-y", "auto");
        style("max-height", "33vh");
        step_in();
            summary("Source");
            pre(example);
            style("font-size", "1rem");
        step_out();

        let x = element("div");
        step_in();
            example();
        step_out();

        if (example_changed) {
            mark_removed(x);
            request_rerender();
        }
    });
}
