// NOTE: Experimental, likely to change

import { element, container, text, step_out, hook, attr, request_rerender } from "../odmah.mjs";

/** @arg {string} label */
export function button(label) {
    container("button");
        text(label);
    step_out();
    return hook("click");
}

/** @arg {string} value */
export function input_string(value) {
    let input = element("input");
    if (hook("input")) {
        value = input.value;
    } else {
        input.value = value;
    }
    return value;
}

/** @arg {number} value */
export function input_int(value) {
    value = Math.round(value);

    let input = element("input");
    attr("type", "number");

    if (hook("blur")) {
        value = parseInt(input.value, 10);
        if (!Number.isNaN(value)) {
            input.valueAsNumber = value;
        }
    } else {
        input.valueAsNumber = Math.round(value);
    }

    return value;
}

/** @arg {number} value */
export function input_float(value) {
    let input = element("input");
    attr("type", "number");

    if (hook("blur")) {
        value = parseFloat(input.value);
        if (!Number.isNaN(value)) {
            input.valueAsNumber = value;
        }
    } else {
        input.valueAsNumber = value;
    }

    return value;
}

/** @arg {boolean} value */
export function checkbox(value) {
    value = !!value;
    let old = value;

    let input = element("input");
    attr("type", "checkbox");

    if (hook("input")) value = !!input.checked;
    else input.checked = value;

    if (old != value) request_rerender();
    return value;
}

/**
@template T
@arg {T} value
@arg {Record<string, T>} options
*/
export function select(value, options) {
    let keys = Object.keys(options);

    let select = container("select");
        let changed = hook("change");

        for (let i=0; i<keys.length; i++) {
            let key = /** @type {string} */(keys[i]);
            let val = /** @type {T} */(options[key]);
            let option = container("option");
                option.value = key;
                if (changed && select.value == key) {
                    value = val;
                } else if (!changed && val == value) {
                    select.value = key;
                }
            step_out();
        }
    step_out();

    return value;
}
