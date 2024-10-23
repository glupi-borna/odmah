import { request_rerender, get_current_cursor, get_element_state } from "../odmah.js";

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

/**
@template T
@template DEFAULT
@typedef {
    ({ state: "loading", data: T|DEFAULT } |
    { state: "done", data: T } |
    { state: "error", data: T|DEFAULT, error: any })
    & { load(get_data: () => Promise<T>): void }
} Sync_Data
*/

/**
@template T
@template [DEFAULT=null]
@arg {() => Promise<T>} get_data
@arg {DEFAULT} default_value
@return {Sync_Data<T, DEFAULT>}
*/
export function sync(
    get_data,
    // @ts-ignore
    default_value=null,
    cursor=get_current_cursor()
) {
    let state = get_element_state(cursor.last_element);
    let key = "sync_data_" + (get_data.name || get_data.toString());

    if (key in state) {
        return state[key];
    } else {
        /** @type {Sync_Data<T, DEFAULT>} */
        let sync_data = { state: "loading", load, data: default_value };
        state[key] = sync_data;

        /** @arg {() => Promise<T>} get_data */
        function load(get_data) {
            sync_data.state = "loading";
            get_data().then(res => {
                sync_data.state = "done";
                if (sync_data.state == "done") sync_data.data = res;
            }).catch(err => {
                sync_data.state = "error";
                if (sync_data.state == "error") sync_data.error = err;
            }).finally(() => request_rerender(cursor));
        }

        load(get_data);
        return sync_data;
    }

}
