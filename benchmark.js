"use strict"

import { odmah, container, step_out, text, style, css, attr, request_rerender } from "./odmah.js";
import { button, input_int, checkbox } from "./modules/components.js";
import { timer_begin, timer_end, timer_stats } from "./modules/timing.js";

/** @type {Text} */
let stats_target;
function stats_start() {
    container("pre");
    stats_target = text("Frame time stats (for last 100 frames)\n");
    step_out();
    timer_begin();
}

function stats_end() {
    timer_end();
    let stats = timer_stats();
    let keys = /** @type {(keyof typeof stats)[]} */(Object.keys(stats));
    let str = "Frame time stats (for last 100 frames)\n";
    for (let key of keys) {
        str += key + ": " + stats[key] + "ms\n";
    }
    stats_target.data = str;
}

let config = {
    color_flip: false,
    unlocked: false,
    count: 10,
};

let n = 1;
function button_counter() {
    if (config.color_flip) n = n == 1 ? 0 : 1;

    container("div"); css(`
        @this {
            display: flex;
            flex-flow: row wrap;
            gap: .25em;

            button {
                flex: 1;
                transition: none;
            }
        }
    `);

    for (let i=0; i<config.count; i++) {
        if (button("Button " + i)) alert(`Clicked button ${i}`);

        style((n+i)%2 == 1 || i%5==0 ? "" : "background: #9af");
        attr("data-idx", i);
        if (i%5==0) {
            attr("disabled");
            attr("title", "This button is divisible by 5");
        }
    }
    step_out();
}

function main() {
    odmah(function() {
        container("fieldset"); style(`
            display: flex;
            flex-flow: column;
            margin-bottom: 1em;
        `);
            stats_start();
            css(`
                label {
                    display: flex;
                    flex-flow: row nowrap;
                    gap: .5em;
                    align-items: end;
                }
            `);

            button("Rerender"); style("max-width: max-content");

            container("label");
                text("Force rerenders");
                config.unlocked = checkbox(config.unlocked);
            step_out();
            if (config.unlocked) request_rerender();

            container("label");
                text("Blink");
                config.color_flip = checkbox(config.color_flip);
            step_out();

            container("label");
                text("Button count");
                config.count = input_int(config.count);
            step_out();
        step_out();

        button_counter();
        stats_end();
    });
};

if (document.readyState === "complete") {
    main();
} else {
    window.addEventListener("load", main);
}
