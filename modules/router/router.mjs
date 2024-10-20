import { text, get_current_cursor, set_current_cursor, hook } from "../../odmah.mjs";
import page from "./page.mjs";

/**
@type {{
    fn(): void;
    error_ui(error: any): any;
    init: boolean;
    events: EventTarget;
}}
*/
export const router_state = {
    fn: () => undefined,
    error_ui: text,
    init: false,
    events: new EventTarget()
};

/** @arg {string} base */
export function router_base(base) {
    page.base(base);
}

/**
@arg {string|ErrorConstructor} path
@arg {() => void} fn
*/
export function route(path, fn) {
    console.log({register: path})
    if (path == Error) {
        router_state.error_ui = fn;
        return;
    }

    page(path, () => {
        let from = router_state.fn;
        router_state.fn = fn;
        console.log(path);
        router_state.events.dispatchEvent(
            new CustomEvent("route-changed", {detail: { from, to: fn }})
        );
    });
}

export function current_route_fn() {
    if (!router_state.init) {
        page({ window, hashbang: true, click: true });
        router_state.init = true;
    }

    hook("route-changed", undefined, router_state.events);

    let save_point = {...get_current_cursor()};
    try {
        router_state.fn();
    } catch (err) {
        set_current_cursor(save_point);
        console.error(err);
        router_state.error_ui(err);
    }
}

/** @arg {string} path */
export function navigate(path) {
    page(path);
}
