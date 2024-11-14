import { element, container, step_out, text, attr, hook } from "../odmah.js";
import { dedent } from "../modules/utils.js";

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
    return !!hook("click", undefined, button);
}
