import { create_element, step_into, get_current_cursor } from "../../odmah.js";

/** @type {Map<string, Element>} */
let id_map = new Map();

/**
@template {keyof HTMLElementTagNameMap} T
@arg {`${T}#${string}`} tag_with_id
*/
export function container_id(tag_with_id, cursor=get_current_cursor()) {
    let hash_idx = tag_with_id.indexOf("#")
    let tagname = /** @type {T} */(tag_with_id.slice(0, hash_idx));

    let el = /** @type {HTMLElementTagNameMap[T]|undefined} */(id_map.get(tag_with_id));
    if (!el) {
        el = create_element(tagname);
        id_map.set(tag_with_id, el);
    }

    if (cursor.node == null) {
        cursor.parent.append(el);
        return step_into(el, cursor);
    } else {

        if (cursor.node !== el) cursor.node.replaceWith(el);
        return /** @type {HTMLElementTagNameMap[T]} */(step_into(el, cursor));
    }
}
