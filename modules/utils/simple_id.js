import { create_element, step_into, step_out, get_current_cursor } from "../../odmah.js";

/** @type {Map<string, Element>} */
let id_map = new Map();

/**
@template {keyof HTMLElementTagNameMap} T
@arg {`${T}#${string}`} tag_with_id
*/
export function get_element(tag_with_id) {
    let el = /** @type {HTMLElementTagNameMap[T]|undefined} */(id_map.get(tag_with_id));
    if (!el) {
        let hash_idx = tag_with_id.indexOf("#")
        let tagname = /** @type {T} */(tag_with_id.slice(0, hash_idx));
        el = create_element(tagname);
        id_map.set(tag_with_id, el);
    }
    return el;
}

/**
@template {keyof HTMLElementTagNameMap} T
@arg {`${T}#${string}`} tag_with_id
*/
export function container_id(tag_with_id, cursor=get_current_cursor()) {
    let el = get_element(tag_with_id);

    if (cursor.node == null) {
        cursor.parent.append(el);
        return step_into(el, cursor);
    } else {

        if (cursor.node !== el) cursor.node.replaceWith(el);
        return /** @type {HTMLElementTagNameMap[T]} */(step_into(el, cursor));
    }
}

/**
@template {keyof HTMLElementTagNameMap} T
@arg {`${T}#${string}`} tag_with_id
*/
export function element_id(tag_with_id, cursor=get_current_cursor()) {
    const out = container_id(tag_with_id, cursor);
    step_out();
    return out;
}
