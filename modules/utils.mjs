import { request_rerender } from "../odmah.mjs";

/**
@template T
@arg {T[]} array
@arg {T} item
*/
export function array_remove(array, item) {
    array_remove_index(array, array.indexOf(item));
}

/**
@arg {any[]} array
@arg {number} idx
*/
export function array_remove_index(array, idx) {
    if (idx < 0 || idx >= array.length) return;
    queueMicrotask(Array.prototype.splice.bind(array, idx, 1));
    request_rerender();
}
