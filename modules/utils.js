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

/** @arg {string} text */
function get_leading_ws(text) {
    let ws_len = text.length - text.trimStart().length;
    return text.slice(0, ws_len);
}

/** @arg {string} text */
export function dedent(text) {
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

const domparser = new DOMParser();
/** @type {Map<string, ChildNode[]>} */
const domparser_cache = new Map();

/** @arg {string} contents */
export function html(contents, cursor=get_current_cursor()) {
    let nodes = domparser_cache.get(contents);
    if (nodes == undefined) {
        let doc = domparser.parseFromString(contents, "text/html");
        nodes = Array.from(doc.body.childNodes);
        domparser_cache.set(contents, nodes);
    }

    if (cursor.node == null) {
        cursor.parent.append(...nodes.map(n=>n.cloneNode(true)));
    } else {
        for (let i=0; i<nodes.length; i++) {
            let node = /** @type {Node} */(nodes[i]);
            if (cursor.node == null) {
                cursor.parent.append(...nodes.map(n=>n.cloneNode(true)).slice(i));
                break;
            } else if (!cursor.node.isEqualNode(node)) {
                node = node.cloneNode(true);
                cursor.node.replaceWith(node);
                cursor.node = /** @type {ChildNode} */(node);
            }
            cursor.node = cursor.node?.nextSibling ?? null;
        }
    }
}

/** @arg {string} contents */
export function raw(contents) {
    return dedent(contents.replaceAll("<", "&lt;"));
}

