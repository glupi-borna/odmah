let count = 0;

function wrapped_text(tagname, ...txt) {
    element(tagname);
    step_in();
    for (let t of txt)
        if (t) text(t);
    step_out();
}

// p is a div because p elements have margins which need to be disabled and I am
// legally obliged not to write css.
const p = wrapped_text.bind(null, "div");
const legend = wrapped_text.bind(null, "legend");

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

function counter() {
    p(count+"", count%2==0 ? " is even" : null);

    if (Button("+1")) {
        count++;
        request_rerender();
    }
}

function button_counter() {
    let div = element("div");
    div.style.display = "flex";
    div.style.gap = "1em";
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
    step_out();
    p("Count: ", count+"");

    element("div");
    step_in();
        text("The buttons:");
    step_out();

    for (let i=0; i<count; i++) {
        element("div");
        step_in();
            if (Button("Button " + i)) {
                alert(`Clicked button ${i}`);
            }
        step_out();
    }
}

let _id = 0;
let data = new Array(1000).fill(null).map(() => {
    return {
        id: ++_id,
        name: word(),
        code: "#"+digits_str(7),
        date: new Date(Date.now() + int(0, 1000000))
    };
});
let columns = ["id", "name", "code", "date"];

function editable_table() {
    let input = element("input");
    input.placeholder = "Search...";
    hook(input, "input");
    const search = input.value;

    element("table");
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
        for (let i=0; i<data.length; i++) {
            let item = data[i];
            if (!item.name.includes(search)) continue;

            let tr = element("tr");
            step_in();
                for (let key of columns) {
                    element("td")
                    step_in();
                        switch (typeof item[key]) {
                            case "number": {
                                if (Button("+1")) {
                                    item[key]++;
                                }
                                if (Button("-1")) {
                                    item[key]--;
                                }
                            } break;

                            case "string": {
                                let input = element("input");
                                let changed = hook(input, "input");
                                if (changed) {
                                    item[key] = input.value;
                                }
                                input.value = item[key];
                            } break;
                        }
                        text(item[key] + "");
                    step_out();
                }

                element("td");
                step_in();
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

window.onload = function() {
    let unlocked = false;
    let example = counter;

    odmah(function() {
        stats();

        if (Button(unlocked ? "Dirty flag optimisation" : "Brrrrr")) {
            unlocked = !unlocked;
            request_rerender();
        }

        if (unlocked) {
            request_rerender();
        }

        element("div");
        step_in();
            text("Examples:");
            let examples = { counter, button_counter, editable_table };
            for (let name in examples) {
                let current = examples[name] == example;
                if (Button((current ? ">" : "") + name)) {
                    example = examples[name];
                    request_rerender();
                }
            }
        step_out();

        element("h1");
        step_in();
            text(example.name);
        step_out();

        example();
    });
}
