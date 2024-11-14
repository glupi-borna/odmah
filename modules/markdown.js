import { get_current_cursor } from "../odmah.js";
import { html, dedent } from "./utils.js";
import { Remarkable } from "./vendored/remarkable.2.0.1.js";

const remarkable = new Remarkable("full", {});
/** @type {Map<string, string>} */
const md_cache = new Map();

/** @arg {string} text */
export function markdown(text, cursor=get_current_cursor()) {
    let parsed = md_cache.get(text);

    if (parsed == undefined) {
        parsed = remarkable.render(dedent(text), {});
        md_cache.set(text, parsed);
    }

    html(parsed, cursor);
}

