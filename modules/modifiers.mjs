// NOTE: Experimental, likely to change

/** @typedef {(e: Event) => void} Modifier */
const odmah_id_map = new Map();

/**
@template {import("../odmah.mjs").Odmah_Value_Getter<any, any>} HOOK
@arg {HOOK} hook_fn
@arg {...Modifier} modifiers
@return {HOOK}
*/
export function with_modifiers(hook_fn, ...modifiers) {
    let odmah_id = hook_fn.toString();
    for (let m of modifiers) odmah_id += "\\" + (m.name || m.toString());
    if (odmah_id_map.has(odmah_id)) return odmah_id_map.get(odmah_id);

    let hook_with_modifiers = /** @type {HOOK} */ (function (e) {
        for (let m of modifiers) m(e);
        return hook_fn(e);
    });

    hook_with_modifiers._odmah_id = odmah_id;
    odmah_id_map.set(odmah_id, hook_with_modifiers);
    return hook_with_modifiers;
}

/** @arg {Event} event */
export function prevent_default(event) {
    event.preventDefault();
}

/** @arg {Event} event */
export function stop_propagation(event) {
    event.stopPropagation();
}
