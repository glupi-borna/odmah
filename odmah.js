"use strict"

let assert = /** @type {import("modules/debug.js")["assert"]} */ (_,__) => undefined;
let cast_defined = /** @type {import("modules/debug.js")["cast_defined"]} */ (_, x) => /** @type {any} */(x);
export let get_current_cursor = () => /** @type {Cursor} */(current_cursor);

if (location.hostname == "localhost") {
    ({assert, cast_defined} = await import("./modules/debug.js"));
    get_current_cursor = () => cast_defined("current cursor", current_cursor);
}

/** @arg {Cursor} cursor */
export function set_current_cursor(cursor) {
    current_cursor = cursor;
}

/**
    @arg {Node} node
    @desc Removes all sibling nodes that come after the given node.
*/
function remove_after(node) {
    assert(node instanceof Node, "Not a node");
    while (node.nextSibling)
        node.nextSibling.remove();
}

/** @type {Cursor|null} */
let current_cursor = null;

Element.prototype._attrs = undefined;
Element.prototype._style = "";
Element.prototype._class = "";
Element.prototype._prev_attrs = undefined;
Element.prototype._prev_style = "";
Element.prototype._prev_class = "";
Element.prototype._odmah_hooks = undefined;
Element.prototype._odmah_state = undefined;

/**
@arg {Cursor} cursor
request_rerender() is a neccessary evil when using the needs_update
optimisation - if our state changes out of band (i.e., not via a `hook` event
listener), we will not rerender. This is an escape hatch that allows us to
explicitly set the needs_update flag.
*/
export function request_rerender(cursor=get_current_cursor()) {
    cursor.needs_update = true;
}

/** @template T */
export class Dispatcher {
    /** @typedef {(value: T) => void} Callback */

    /** @arg {T} value */
    constructor(value) {
        this.value = value;
        /** @type {Callback[]} */
        this.callbacks = [];
    }

    /** @arg {Callback} cb */
    onchange(cb) {
        this.callbacks.push(cb);
    }

    /** @arg {Callback} cb */
    unhook(cb) {
        let idx = this.callbacks.indexOf(cb);
        if (idx == -1) return;
        this.callbacks.splice(idx, 1);
    }

    /** @arg {T} value */
    dispatch(value) {
        this.value = value;
        for (let i=0; i<this.callbacks.length; i++) {
            /** @type {Callback} */(this.callbacks[i])(value);
        }
    }
}

/** @typedef {ReturnType<typeof cursor_new>} Cursor */

/**
@arg {() => void} frame_cb
@arg {Element} root
*/
export function cursor_inert(frame_cb, root=document.body) {
    let cursor = {
        /** @type {Element} */
        parent: root,
        /** @type {Element} */
        root: root,
        // When cursor.node is null, cursor is at the end
        // of the parent element's child list.
        /** @type {ChildNode|null} */
        node: null,
        /** @type {Element} */
        last_element: root,

        before_finalize: new Dispatcher(undefined),
        after_finalize: new Dispatcher(undefined),

        /**
            needs_update is an optimisation. Most frames, nothing has changed since the
            last frame, so we can skip a lot of work if we know that nothing has changed.
            This is essentially a "dirty" flag. We only perform the frame callback in
            `odmah` if it is set to `true`.
            We set needs_update to true whenever an event listener (set up by `hook`) is
            triggered.
        */
        needs_update: true,
        marked_for_remove: /** @type {Element[]} */([]),

        current_frame: 0,
        render_loop,

        scoped_css: "",
        stylesheet: document.createElement("style"),
        css_scope_idx: 0,
    };

    function render_loop() {
        cursor_reset(cursor);
        current_cursor = cursor;
        frame_cb();
        current_cursor = null;

        if (cursor.node == null) {
            cursor.node = cursor.parent.lastChild;
        } else {
            cursor.node = cursor.node.previousSibling;
        }

        cursor.before_finalize.dispatch(undefined);
        cursor_finalize(cursor);

        for (let i=0; i<cursor.marked_for_remove.length; i++) {
            (/** @type {Element} */(cursor.marked_for_remove[i])).remove();
        }
        cursor.marked_for_remove.length = 0;

        cursor.after_finalize.dispatch(undefined);
    }

    return cursor;
}

/**
@arg {() => void} frame_cb
@arg {Element} root
*/
export function cursor_new(frame_cb, root=document.body) {
    let cursor = {
        /** @type {Element} */
        parent: root,
        /** @type {Element} */
        root: root,
        // When cursor.node is null, cursor is at the end
        // of the parent element's child list.
        /** @type {ChildNode|null} */
        node: null,
        /** @type {Element} */
        last_element: root,

        before_finalize: new Dispatcher(undefined),
        after_finalize: new Dispatcher(undefined),

        /**
            needs_update is an optimisation. Most frames, nothing has changed since the
            last frame, so we can skip a lot of work if we know that nothing has changed.
            This is essentially a "dirty" flag. We only perform the frame callback in
            `odmah` if it is set to `true`.
            We set needs_update to true whenever an event listener (set up by `hook`) is
            triggered.
        */
        needs_update: true,
        marked_for_remove: /** @type {Element[]} */([]),

        current_frame: 0,
        render_loop,

        scoped_css: "",
        stylesheet: document.createElement("style"),
        css_scope_idx: 0,
    };

    let af = -1;
    setInterval(() => {
        if (cursor.needs_update) {
            cancelAnimationFrame(af);
            af = requestAnimationFrame(render_loop);
        }
    }, 1);

    function render_loop() {
        cursor_reset(cursor);
        current_cursor = cursor;
        frame_cb();
        current_cursor = null;

        if (cursor.node == null) {
            cursor.node = cursor.parent.lastChild;
        } else {
            cursor.node = cursor.node.previousSibling;
        }

        cursor.before_finalize.dispatch(undefined);
        cursor_finalize(cursor);

        for (let i=0; i<cursor.marked_for_remove.length; i++) {
            (/** @type {Element} */(cursor.marked_for_remove[i])).remove();
        }
        cursor.marked_for_remove.length = 0;

        cursor.after_finalize.dispatch(undefined);
    }

    return cursor;
}

/** @arg {Cursor} cursor */
function cursor_reset(cursor) {
    cursor.parent = cursor.root;
    cursor.node = cursor.parent.firstChild;
    cursor.needs_update = false;
    cursor.last_element = document.body;
    cursor.current_frame++;
    cursor.marked_for_remove.length = 0;
}


/** @typedef {Attrs} Attrs_ */
class Attrs {
    constructor() {
        /** @type {string[]} */
        this.keys = [];
        /** @type {any[]} */
        this.values = [];
        this.length = 0;
    }

    /** @arg {string} key */
    idx(key) {
        let idx = this.keys.indexOf(key);
        return idx < this.length ? idx : -1;
    }

    /** @arg {string} key */
    get(key) {
        let idx = this.idx(key);
        if (idx == -1) return undefined;
        return this.values[idx];
    }

    /**
    @arg {string} key
    @arg {any} val
    */
    set(key, val) {
        let idx = this.idx(key);

        if (idx == -1) {
            this.keys[this.length] = key;
            this.values[this.length] = val;
            this.length++;
        } else {
            this.values[idx] = val;
        }
    }

    /**
    @arg {string} key
    @arg {any} val
    */
    append(key, val) {
        let idx = this.idx(key);

        if (idx == -1) {
            this.keys[this.length] = key;
            this.values[this.length] = val;
            this.length++;
        } else {
            this.values[idx] += val;
        }
    }

    /** @arg {string} key */
    delete(key) {
        let idx = this.idx(key);
        if (idx != -1) {
            this.delete_idx(idx);
        }
    }

    /** @arg {number} idx */
    delete_idx(idx) {
        let last = this.length-1;
        this.keys[idx] = /** @type {string} */(this.keys[last]);
        this.values[idx] = this.values[last];
        this.length--;
    }

    /** @arg {string} key */
    has(key) {
        return this.idx(key) != -1;
    }

    clear() {
        this.length = 0;
    }

    clone() {
        let attrs = new Attrs();
        attrs.length = this.length;
        attrs.keys = this.keys.slice();
        attrs.values = this.values.slice();
        return attrs;
    }
}

/**
@arg {string} name
@arg {any} value
@arg {Element} el
Sets an attribute on the element.
*/
export function attr(name, value="", el=get_current_cursor().last_element) {
    cast_defined("Element attrs", el._attrs).set(name, value);
    if (!el._prev_attrs || el._prev_attrs.get(name) != value) {
        el.setAttribute(name, value);
    }
}

/**
@arg {string} name
@arg {Element} el
Sets a class on the element.
*/
export function cls(name, el=get_current_cursor().last_element) {
    // cast_defined("Element attrs", el._attrs).append("class", name+" ");
    el._class = (el._class || "") + " " + name;
}

/**
@arg {string} name
@arg {Element} el
Gets the value of an attribute on the element.
*/
export function get_attr(name, el=get_current_cursor().last_element) {
    let attrs = cast_defined("Element attrs", el._attrs);
    let idx = attrs.idx(name);
    if (idx >= 0) return attrs.values[idx];
    if (el._prev_attrs) return el._prev_attrs.get(name);
    return undefined;
}

function get_css_scope(cursor=get_current_cursor()) {
    cursor.css_scope_idx++;
    return "css_scope_" + cursor.css_scope_idx;
}

/**
@arg {string} css_code
@arg {string} scope
*/
function css_prep(css_code, scope) {
    return css_code.replace(/@this\./g, scope).replace(/@this\b/g, "."+scope);
}

/**
@arg {string} css_code
@arg {Cursor} cursor
Appends styles to the current element.
*/
export function css(css_code, cursor=get_current_cursor()) {
    if (css_code.includes("@this")) {
        let scope = get_css_scope(cursor);
        cursor.scoped_css += css_prep(css_code, scope);
        cls(scope);
    } else {
        cursor.scoped_css += css_code;
    }
}

/**
@arg {string} css
@arg {Element} el
Appends styles to the element.
*/
export function style(css, el=get_current_cursor().last_element) {
    // cast_defined("Element attrs", el._attrs).append("style", css);
    el._style = (el._style || "") + css;
}

/**
@arg {string} css
@arg {Element} el
Sets the style string of the element.
*/
export function set_style(css, el=get_current_cursor().last_element) {
    // cast_defined("Element attrs", el._attrs).append("style", css);
    el._style = css;
}

/**
@arg {EventTarget} el
@returns {Hook_Data[]}
Gets the previous attributes set on the element.
*/
function get_hooks(el) {
    if (el._odmah_hooks == undefined) el._odmah_hooks = [];
    return el._odmah_hooks;
}

/**
@arg {Element} el
@returns {Partial<Record<string, any>>}
Gets the permanent element state.
*/
export function get_element_state(el=get_current_cursor().last_element) {
    if (el._odmah_state == undefined) el._odmah_state = {};
    return el._odmah_state;
}

/** @arg {Element} element */
function finalize(element) {
    let attrs = element._attrs;
    let prev_attrs = element._prev_attrs;
    if (!attrs) return;
    if (!prev_attrs) prev_attrs = new Attrs();

    let prev_keys = prev_attrs.keys;
    for (let i=0; i<prev_attrs.length; i++) {
        let key = /** @type {string} */(prev_keys[i]);
        if (!attrs.has(key)) element.removeAttribute(key);
    }

    if (element._prev_style != element._style) {
        element.setAttribute("style", element._style + "");
    }

    if (element._prev_class != element._class) {
        element.className = element._class || '';
    }

    element._prev_attrs = attrs;
    element._prev_class = element._class || '';
    element._prev_style = element._style || '';
    element._attrs = prev_attrs;
    element._style = "";
    element._class = "";
    prev_attrs.length = 0;
}

function render_finalize(cursor=get_current_cursor()) {
    let iter = document.createNodeIterator(cursor.root, NodeFilter.SHOW_ELEMENT);
    finalize(cursor.root);
    let n;
    while (n=iter.nextNode()) finalize(/** @type {Element} */(n));
}

/** @arg {Cursor} cursor */
function cursor_finalize(cursor=get_current_cursor()) {
    let stylesheet = cursor.stylesheet;
    if (!stylesheet.isConnected) document.head.append(stylesheet);
    if (cursor.scoped_css != stylesheet.innerHTML) stylesheet.innerHTML = cursor.scoped_css;
    cursor.scoped_css = "";
    cursor.css_scope_idx = 0;

    while (cursor.node) {
        if (cursor.node == cursor.root) break;
        remove_after(cursor.node);
        cursor.node = cursor.parent;
        if (cursor.node) {
            cursor.parent = cast_defined(
                "Parent element of cursor node",
                cursor.node.parentElement
            );
        }
    }

    render_finalize(cursor);
}

/**
@arg {Element} el
@arg {Cursor} cursor
Remove the element before the frame has been rendered.
*/
export function mark_removed(el, cursor=cast_defined("cursor", current_cursor)) {
    cursor.marked_for_remove.push(el);
}

/** @arg {() => void} frame_cb */
export function odmah(frame_cb) {
    let cursor = cursor_new(frame_cb);
    cursor.render_loop();
}

function default_value_getter() { return true; }

/**
@template {Event} EVENT
@template RETURN
@typedef {
    ((e: EVENT) => RETURN) & {
        _odmah_id?: string
    }
} Odmah_Value_Getter
*/

/**
@template [T=unknown]
@typedef {{
    event: string;
    value_getter_str: string;
    happened_on_frame: number;
    value: T|undefined;
}} Hook_Data
*/

/**
@template {Event_Types<TARGET>} EVENT
@template [RETURN=boolean]
@template {EventTarget} [TARGET=HTMLElement]
@arg {EVENT} event
@arg {Odmah_Value_Getter<Event_Value<TARGET, EVENT>, RETURN>} [value_getter]
@arg {TARGET} [target]
@arg {Cursor} [cursor]
@returns {Hook_Data<RETURN>}
*/
export function hook_data(
    event,
    // @ts-expect-error
    // The default value getter just returns true, so if somebody were
    // to call hook<string>("click"), typescript would indicate that the
    // returned value is a string, when in reality it will be a boolean.
    // I don't care about this and want to provide a nice default.
    value_getter=default_value_getter,
    target,
    cursor=get_current_cursor(),
) {
    if (target == undefined) target = /** @type {TARGET} TY, typescript */(
        /** @type {unknown} */(cursor.last_element)
    );

    let el_hooks = get_hooks(target);
    /** @type {Hook_Data<RETURN>|undefined} */
    let hook = undefined;
    let value_getter_str = value_getter.name || value_getter.toString();

    for (let i=0; i<el_hooks.length; i++) {
        // This cast is technically not correct, but we check it with
        // `h.event != event.key` afterwards.
        let h = /** @type {Hook_Data<RETURN>} */(el_hooks[i]);
        if (h.event != event) continue;
        if (h.value_getter_str != value_getter_str) continue;
        hook = h;
        break;
    }

    if (!hook) {
        hook = {
            event, value_getter_str,
            happened_on_frame: -1,
            value: undefined
        };
        const h = hook;
        el_hooks.push(hook);
        target.addEventListener(
            event,
            function (e) {
                request_rerender(cursor);
                // @ts-expect-error
                // It is hard to type this properly.
                // It's fine like this.
                h.value = value_getter(e);
                h.happened_on_frame = cursor.current_frame;
            }
        );
    }

    return hook;
}

// I'm gonna do what's called a "pro gamer move"
/**
@overload
@arg {All_Event_Types|(string & {})} event
@returns {true|undefined}
*/

/**
@template {Event_Types<TARGET>|(string & {})} EVENT
@template {EventTarget} TARGET
@overload
@arg {EVENT} event
@arg {TARGET} target
@returns {true|undefined}
*/

/**
@template {All_Event_Types|(string & {})} EVENT
@template {any} RETURN
@overload
@arg {EVENT} event
@arg {Odmah_Value_Getter<Guess_Event_Value<EVENT>, RETURN>} value_getter
@returns {RETURN|undefined}
*/

/**
@template {Event_Types<TARGET>} EVENT
@template {EventTarget} TARGET
@template {any} RETURN
@overload
@arg {EVENT} event
@arg {Odmah_Value_Getter<Guess_Event_Value<EVENT>, RETURN>} value_getter
@arg {TARGET} target
@arg {Cursor} [cursor]
@returns {RETURN|undefined}
*/

/**
@template {Event_Types<TARGET>} EVENT
@template {EventTarget} TARGET
@template {any} RETURN
@overload
@arg {EVENT} event
@arg {TARGET} target
@arg {Odmah_Value_Getter<Guess_Event_Value<EVENT>, RETURN>} value_getter
@arg {Cursor} [cursor]
@returns {RETURN|undefined}
*/

/**
@template {any} RETURN
@template {Odmah_Value_Getter<Event, RETURN> | EventTarget} FIRST
@arg {string} event
@arg {FIRST} [arg1]
@arg {FIRST extends Odmah_Value_Getter<Event, RETURN> ? EventTarget : Odmah_Value_Getter<Event, RETURN>} [arg2]
@arg {Cursor} [cursor]
@returns {RETURN|undefined}
*/
export function hook(
    event,
    // @ts-expect-error
    arg1=default_value_getter,
    arg2,
    cursor=get_current_cursor(),
) {
    /** @type {Odmah_Value_Getter<any, any>} */
    let value_getter;
    /** @type {EventTarget} */
    let target;

    if (typeof(arg1) == "function") {
        value_getter = arg1;
        target = /** @type {EventTarget} */(arg2) ?? cursor.last_element;
    } else {
        target = arg1 ?? cursor.last_element;
        value_getter = /** @type {Odmah_Value_Getter<any, any>} */(arg2 ?? default_value_getter);
    }

    let data = hook_data(event, value_getter, target, cursor);

    if (cursor.current_frame-1 == data.happened_on_frame) {
        return data.value;
    }

    return undefined;
}

/**
@template {keyof HTMLElementTagNameMap} T
@arg {T} tagname
@returns {HTMLElementTagNameMap[T]}
*/
export function create_element(tagname) {
    return document.createElement(tagname);
}

/**
@arg {Node} node
@returns {node is Element}
*/
export function is_element(node) {
    return node.nodeType == 1;
}

/**
@template {Element} T
@arg {T} el
@arg {Cursor} cursor
*/
export function step_into(el, cursor=get_current_cursor()) {
    if (!el._attrs) el._attrs = new Attrs();
    cursor.last_element = el;
    cursor.parent = el;
    cursor.node = el.firstChild;
    return el;
}

/**
@template {keyof HTMLElementTagNameMap} T
@arg {T} tagname
@arg {Cursor} cursor
@returns {HTMLElementTagNameMap[T]}
*/
export function container(tagname, cursor=get_current_cursor()) {
    if (cursor.node == null) {
        /** @type {HTMLElementTagNameMap[T]} */
        let el = create_element(tagname);
        cursor.parent.append(el);
        return step_into(el, cursor);

    } else {

        if (is_element(cursor.node)) {
            if (tagname != cursor.node.localName) {
                let el = create_element(tagname);
                cursor.node.replaceWith(el);
                return step_into(el, cursor);
            }

            return /** @type {HTMLElementTagNameMap[T]} */(step_into(cursor.node, cursor));

        } else /* It is a text node */ {
            let el = create_element(tagname);
            cursor.node.replaceWith(el);
            return step_into(el, cursor);
        }
    }
}

/**
@arg {string} txt
@arg {Cursor} cursor
@returns {Text}
*/
export function text(txt, cursor=get_current_cursor()) {
    if (cursor.node == null) {
        let t = new Text(txt);
        cursor.parent.append(t);
        return t;

    } else {
        const node = /** @type {Text|Element} */(cursor.node);

        if (is_element(node)) {
            let t = new Text(txt);
            node.replaceWith(t);
            cursor.node = t.nextSibling;
            return t;

        } else /* It is a text node */ {
            if (node.data != txt) node.data = txt;
            let ret = /** @type {Text} */(cursor.node);
            cursor.node = node.nextSibling;
            return ret;
        }
    }
}

export function step_out(cursor=get_current_cursor()) {
    assert(cursor.parent, "Stepping out into nothing!");
    assert(cursor.parent.parentElement, "Stepping out into nothing!");

    let out = cursor.parent;
    if (cursor.node) {
        if (cursor.node.previousSibling) {
            remove_after(cursor.node.previousSibling);
        } else {
            while (cursor.parent.firstChild) cursor.parent.firstChild.remove();
        }
    }
    cursor.node = cursor.parent.nextSibling;
    cursor.parent = cursor.parent.parentElement;
    return out;
}

/**
@template {keyof HTMLElementTagNameMap} T
@arg {T} tagname
@arg {Cursor} cursor
@returns {HTMLElementTagNameMap[T]}
*/
export function element(tagname, cursor=get_current_cursor()) {
    let el = container(tagname, cursor);
    step_out(cursor);
    return el;
}
