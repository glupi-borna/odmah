import { hook } from "../odmah.js";

/**
@typedef {{
    url: string;
    url_parts: string[];
    callback: () => void;
}} Route
*/

/**
@typedef {{
    hash: boolean;
    base: string;
}} Router_Options
*/

/**
@typedef {{
    routes: Route[];
    params: Record<string, string|undefined>;
    route(url: string, callback: () => void): void;
    route_matches(route: string|Route, url: string): boolean;
    current_route(): void;
    navigate(url: string): void;
} & Readonly<Router_Options>} Router
*/

/**
@arg {Partial<Router_Options>} options
@returns {Router}
*/
export function create_router(options) {
    /**
    @arg {string} url
    @arg {() => void} callback
    */
    function route(url, callback) {
        router.routes.push({
            callback, url, url_parts: parse_parts(url)
        });
    }

    /** @type {(url: string) => string} */
    let normalize_url;
    if (options.hash ?? true) {
        normalize_url = function normalize_url(url) {
            if (url.startsWith(router.base)) url = url.slice(router.base.length);
            if (url.startsWith("#/")) url = url.slice(1);

            let hash_idx = url.indexOf("#");
            // If there is a hash component to the url, we throw it away
            if (hash_idx != -1) url = url.slice(0, hash_idx);
            if (url == "") url = "/";

            return url;
        }
    } else {
        normalize_url = function normalize_url(url) {
            if (url.startsWith(router.base)) url = url.slice(router.base.length);

            let hash_idx = url.indexOf("#");
            // If there is a hash component to the url, we throw it away
            if (hash_idx != -1) url = url.slice(0, hash_idx);
            if (url == "") url = "/";

            return url;
        }
    }

    /**
    @arg {string|Route} route
    @arg {string} url
    */
    function route_matches(route, url) {
        if (typeof(route) == "string") {
            route = {
                url: route,
                url_parts: parse_parts(route),
                callback: close
            };
        }
        url = normalize_url(url);
        if (!url.startsWith("/")) return false; // Can't match a relative route?
        return route_matches_(route, parse_parts(url));
    }

    /**
    @arg {Route} route
    @arg {string[]} url_parts
    */
    function route_matches_(route, url_parts) {
        if (url_parts.length != route.url_parts.length) return false;

        for (let i=0; i<url_parts.length; i++) {
            let route_part = /** @type {string} */(route.url_parts[i]);
            if (route_part.startsWith("<") && route_part.endsWith(">")) continue;
            let url_part = url_parts[i];
            if (route_part != url_part) return false;
        }

        return true;
    };

    /** @arg {string} url */
    function get_matching_route(url) {
        let url_parts = parse_parts(normalize_url(url));

        for (let route of router.routes) {
            if (route_matches_(route, url_parts)) return route;
        }

        return null;
    }

    /** @arg {Node} e */
    function node_name(e) {
        if (e.nodeType == Node.ELEMENT_NODE) {
            return /** @type {Element} */(e).nodeName.toLowerCase();
        }
        return undefined;
    }

    /** @arg {MouseEvent} e */
    function click_handler(e) {
        if (e.defaultPrevented) return;
        if (e.button != 0) return;
        if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

        /** @type {Node|null} */
        let target = null;
        let path = e.composedPath();
        for (let i=0; i<path.length; i++) {
            let et = path[i];
            if (et instanceof Node && node_name(et) == "a") {
                target = et;
                break;
            }
        }

        while (target && node_name(target) != "a") target = target.parentNode;
        if (!target) return;

        let anchor = /** @type {HTMLAnchorElement} */(target);
        if (anchor.origin != window.location.origin) return;
        if (anchor.target && anchor.target.toLowerCase() != "_self") return;
        if (anchor.hasAttribute("download")) return;
        if (anchor.hasAttribute("external")) return;

        e.preventDefault();
        // @TODO: window.scrollIntoView when there is a hash component?
        // @TODO: fallback when route is not found?
        navigate(anchor.getAttribute("href") ?? '');
    }

    /** @arg {string} url */
    function navigate(url) {
        window.history.pushState(null, "", url);
        window.dispatchEvent(new Event("routing"));
    }

    /** @type {Route|null} */
    let curr_route = null;
    let initial = true;

    /**
    @arg {Route} route
    @arg {string} url
    */
    function update_route_params(route, url) {
        router.params = {};
        url = normalize_url(url);
        let url_parts = parse_parts(url);

        for (let i=0; i<route.url_parts.length; i++) {
            let route_part = /** @type {string} */(route.url_parts[i]);
            if (route_part.startsWith("<") && route_part.endsWith(">")) {
                let param_name = route_part.slice(1, -1);
                router.params[param_name] = /** @type {string} */(url_parts[i]);
            }
        }
    }

    function current_route() {
        if (initial) {
            initial = false;
            let url = window.location.toString();
            curr_route = get_matching_route(url);
            if (curr_route) update_route_params(curr_route, url);
        }

        if (hook("popstate", undefined, window) || hook("routing", undefined, window)) {
            let url = window.location.toString();
            curr_route = get_matching_route(url);
            if (curr_route) update_route_params(curr_route, url);
        }

        if (curr_route == null) return;
        curr_route.callback();
    }

    let router = {
        routes: /** @type {Route[]} */([]),
        route, route_matches, current_route, navigate,
        hash: true,
        base: /** @type {string} */(document.baseURI.split("#")[0]),
        params: /** @type {Record<string, string>} */({}),
        ...options
    };
    document.addEventListener("click", click_handler);

    return router;
}

/**
@arg {string} url
*/
function parse_parts(url) {
    return url.split("/");
}
