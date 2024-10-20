import { element, container, step_out, text, attr, hook, get_current_cursor, attrs_finalize } from "../odmah.mjs";

/** @arg {string} text */
function get_leading_ws(text) {
    let ws_len = text.length - text.trimStart().length;
    return text.slice(0, ws_len);
}

/** @arg {string} text */
function dedent(text) {
    let lines = text.split("\n");
    let first_nonempty = 0;
    while (first_nonempty < lines.length) {
        let line = /** @type {string} */(lines[first_nonempty]);
        if (line.trim() == "") {
            first_nonempty++;
        } else {
            break;
        }
    }

    let last_nonempty = lines.length-1;
    while (last_nonempty > first_nonempty) {
        let line = /** @type {string} */(lines[last_nonempty]);
        if (line.trim() == "") {
            last_nonempty--;
        } else {
            break;
        }
    }

    lines = lines.slice(first_nonempty, last_nonempty+1);
    if (lines.length == 0) return "";

    let common_ws = get_leading_ws(/** @type {string} */(lines[0]));
    for (let i=1; i<lines.length; i++) {
        let line = /** @type {string} */(lines[i]);
        if (line.trim() == "") continue;
        let line_ws = get_leading_ws(line);
        if (line_ws.startsWith(common_ws)) continue;
        common_ws = line_ws;
        if (common_ws.length == 0) break;
    }

    if (common_ws.length > 0) {
        for (let i=0; i<lines.length; i++) {
            let line = /** @type {string} */(lines[i]);
            if (!line.startsWith(common_ws)) continue;
            line = line.slice(common_ws.length);
            lines[i] = line;
        }
    }

    return lines.join("\n");
}

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

/** @arg {string} contents */
export function raw(contents) {
    return dedent(contents.replaceAll("<", "&lt;"));
}

let domparser = new DOMParser();
/** @arg {string} contents */
export function html(contents) {
    let cursor = get_current_cursor();
    attrs_finalize(cursor);
    let doc = domparser.parseFromString(contents, "text/html");
    if (cursor.node == null) {
        cursor.parent.append(...Array.from(doc.body.childNodes));
    } else {
        let count = doc.body.childNodes.length;
        cursor.node.before(...Array.from(doc.body.childNodes));
        while (count && cursor.node) {
            let old = cursor.node;
            cursor.node = cursor.node.nextSibling;
            old.remove();
            count--;
        }
    }
}
