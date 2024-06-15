"use strict"

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
const h1 = wrapped_text.bind(null, "h1");
const pre = wrapped_text.bind(null, "pre");
const summary = wrapped_text.bind(null, "summary");

function stats() {
    let stats = frame_time_stats();
    element("details");
    step_in();
        summary("Frame time stats (for last 1000 frames)");
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
    if (count%2) {
        style("background", count%2?"red":"blue");
        style("color", "white");
    }
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
        if (Button("Button " + i)) {
            alert(`Clicked button ${i}`);
        }
        attr("data-idx", i);
        if (i%5==0) {
            attr("disabled");
            attr("title", "This button is divisible by 5");
        }
        style("background-color", i%2?"red":"blue");
        style("color", "white");
        if (hook("mouseover")) hovers[i] = true;
        if (hook("mouseout")) hovers[i] = false;
        if (hovers[i]) {
            style("background-color", "yellow");
            style("color", "black");
        }
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

/**
    @this {Modifier}
    @arg node
*/
function ui_sine(node) {
    let canvas = element("canvas", node.id);
    attr("width", this.width ?? 300);
    attr("height", this.height ?? 212);
    canvas.width = this.width ?? 300;
    canvas.height = this.height ?? 212;

    if (!this.ctx) {
        this.ctx = canvas.getContext("2d", {
            alpha: false,
            willReadFrequently: false
        });
        this.image = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.image_buf = new Uint32Array(this.image.data.buffer);
        request_rerender();
    }

    let ctx = this.ctx;
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "white";
    ctx.beginPath();
    ctx.moveTo(0, canvas.height/2);
    let d = this.single_period ? Math.PI*2/this.frequency : this.duration;
    for (let i=0; i<=canvas.width; i++) {
        let t = (i/canvas.width)*d;
        let y = (this.get_y(t) + 1) *0.5*canvas.height;
        ctx.lineTo(i, y);
    }
    ctx.stroke();

    step_in();
    step_out();

    // this.frequency = textbox(this.frequency);
    // attr("type", "number");
    // this.frequency = textbox(this.frequency);
    // attr("type", "range");
    // attr("min", -100);
    // attr("max", 100);
    // attr("step", 0.1);
}

function sine_modifier_get_y(t) {
    return Math.sin(t*this.frequency)*this.amplitude;
}

function range_control(property, min, max, step=0.1) {
    return function range_control_ui() {
        let old = this[property];

        element("label");
        step_in();
            text(property);
            this[property] = textbox(this[property]);
            attr("type", "number");
            attr("min", min);
            attr("max", max);
            attr("step", step);
        step_out();
        if (old != this[property]) request_rerender();
    }
}

function checkbox_control(property) {
    return function checkbox_control_ui() {
        let old = this[property];

        element("label");
        step_in();
            text(property);
            this[property] = checkbox(this[property]);
        step_out();

        if (old != this[property]) request_rerender();
    }
}

function sine_modifier() {
    return {
        ui: ui_sine,
        get_y: sine_modifier_get_y,
        duration: 1,
        frequency: 6.14,
        amplitude: 1,
        single_period: false,
        ctx: null, // canvas context
        image: null, // context image data
        image_buf: null, // image data buffer
        inputs: 0,
        output: true,
        controls: [
            range_control("frequency", 0, Infinity, 0.01),
            range_control("amplitude", -Infinity, Infinity, 0.01),
            range_control("duration", 0.001, 10),
            checkbox_control("single_period"),
        ]
    };
}

function sm_node(id, modifier) {
    return {
        id,
        modifier,
        x: 0, y: 0,
        dragging: false,
    };
}

function ui_sm_node(node) {
    element("div", "sm_node::" + node.id);
    style("position", "absolute");
    style("left", `50%`);
    style("top", `50%`);
    style("transform", `translate(${node.x}px, ${node.y}px)`);
    step_in();

        element("div", "sm_node_titlebar::" + node.id);
        style("background", "#333");
        style("color", "white");
        step_in();
            text(" -");
            if (hook("mousedown")) node.dragging = true;
            if (!mouse.left.get()) node.dragging = false;
            if (node.dragging) {
                node.x += mouse.delta_x.get();
                node.y += mouse.delta_y.get();
            }
        step_out();

        element("div", "sm_node_ui::" + node.id);
        style("display", "flex");
        style("flex-flow", "column");
        step_in();
            node.modifier.ui(node);
            for (let control of node.modifier.controls) {
                control.call(node.modifier);
            }
        step_out();

        element("div", "sm_node_io::" + node.id);
        style("display", "flex");
        style("flex-flow", "column");
        step_in();

            if (node.modifier.output) {
                element("div", "sm_node_out::" + node.id);
                styles(`
                    display: flex;
                    flex-flow: column;
                    align-items: flex-end;
                `);
                style("display", "flex");
                style("flex-flow", "column");
                step_in();
                    element("div"); step_in();
                    styles(`
                        border-radius: 100%;
                        width: 16px;
                        height: 16px;
                        background: red;
                    `);
                    step_out();
                step_out();
            }

            for (let i=0; i<node.modifier.inputs; i++) {
                element("div", "sm_node_in::" + node.id + "::" + i);
                style("display", "flex");
                style("flex-flow", "row");
                step_in();
                    element("div"); step_in();
                    styles(`
                        border-radius: 100%;
                        width: 16px;
                        height: 16px;
                        background: red;
                    `);
                    step_out();
                step_out();
            }

        step_out();


    step_out();

}

let nodes = [
    sm_node("node1", sine_modifier()),
    sm_node("node2", sine_modifier())
]

function soundmaker() {
    element("div", "sm_workspace");
    style("position", "relative");
    step_in();
        for (let node of nodes) {
            ui_sm_node(node);
        }
    step_out();
}

let examples = {
    counter,
    button_counter,
    editable_table,
    double_hook,
    inputs,
    conditional_step_in_out,
    soundmaker
};

function select(value, options) {
    let current = null;
    let s = element("select");
    if (hook("change")) value = options[s.value];
    step_in();
    for (let key in options) {
        element("option");
        step_in();
            if (options[key] == value) current = key;
            text(key);
        step_out();
    }
    step_out();
    s.value = current;
    return value;
}

function row_start() {
    element("div");
    style("display", "flex");
    style("flex-flow", "row");
    step_in();
}

function col_start() {
    element("div");
    style("display", "flex");
    style("flex-flow", "column");
    step_in();
}

const end = step_out;

window.onload = function() {
    let unlocked = false;
    let example = soundmaker;

    odmah(function() {
        if (hook("keydown")) {
            request_rerender();
        }

        stats();

        col_start(); {
            style("align-items", "start");
            element("label");
            step_in();
                unlocked = checkbox(unlocked);
                text("Brrrr");
            step_out();

            if (unlocked) request_rerender();

            example = select(example, examples);
            h1(example.name);
        }; end();

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

        let x = element("div", example.name);
        step_in();
            example();
        step_out();
    });
}
