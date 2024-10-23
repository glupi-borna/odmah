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

/**

HOW/WHY
    To make an immediate mode wrapper around a retained mode api (the DOM), we
    need to:
    1. Have a render loop.
        *I think* immediate mode code implies that we write normal, imperative
        code, and the UI is redrawn from scratch every frame. This is nice
        because we don't have to bother with special ways of handling
        application state, and our control flow is easy to understand.

        We achieve this by calling the `odmah` function and providing it a frame
        callback -- a function that renders a single frame of our whole app.

        `odmah` sets up the `requestAnimationFrame` loop that will call our frame
        callback whenever it needs a new frame.

    2. Somehow insert and remove elements on demand without rebuilding the whole
        DOM tree every frame. Somehow handle events synchronously, without
        creating and removing event listeners every frame.

        This is very important, because there is *no way* that we can just
        discard the whole DOM tree every frame. If this was not a wrapper around
        a retained mode UI -- if we were writing our own rendering -- it would
        not be a problem.

        But the browser does not expect to be creating elements and throwing
        them away immediately.

        The browser also keeps around useful state (for example, where the caret
        is within an active input field, etc.). Throwing this away means that we
        have to reimplement it, which is out of the question. Even if it was
        possible to make it run efficiently, I am *not* coding that.

        Instead, this is what I came up with:

        cursor
            We use a cursor to render each frame. The cursor represents a
            place in the DOM tree. It starts each frame at the start of the
            root element.

        element(tagName), text(txt)
            Whenever we want to display an element, we insert it at the cursor,
            and advance the cursor forward.

            When we are about to insert the element at the cursor, we check
            that there isn't already an element of that type under the cursor.
                - If there is, we just advance the cursor, because no other work
                needs to be done.
                - If the element under the cursor is not of the type we want, we
                remove it and insert a new element of the correct type.
                - If there is no element under the cursor, we insert a new
                element of the correct type.

            The same process applies to text nodes -- except when there is a
            text node under the cursor, but the content of that text node is not
            what we want to put there. In that case, we can simply update the
            content of the text node, without inserting or removing anything.

        step_in(), step_out()
            If we want to add children to an element, we move the cursor inside
            of it (by calling step_in() after element()), we display the
            children, and then we move the cursor out (by calling step_out()).

            If there are nodes after the cursor when we are stepping out, we
            remove them -- they must be from a previous frame, and we must not
            have displayed them this frame.
                If you think about it, any node in front of the cursor must be
                from a previous frame, and any node behind the cursor must be
                from this frame. This is simply true of our rendering model.
                Because of this, we can make the above assumption - any element
                after the cursor before we step out of an element must be
                something that was rendered on the previous frame, but not on
                this frame.

        hook(event, element?)
            If we want to synchronously handle events, we have to have some way
            of accessing them synchronously. In immediate mode terms, we want to
            know if something has occured since the last frame was rendered.

            This is rather simple - we attach the desired event listener and,
            when the event fires, we insert it into a map where we can easily
            look it up later.

            The hook(event, element?) function does both these things - sets up
            an event listener (if one does not already exist) and returns the
            value stored in the event map (if one exists).

        Funnily enough, this is *all* we need. Everything else that is here is
        just for quality-of-life & optimisation.
*/

/** @typedef {ReturnType<typeof cursor_new>} Cursor */

/** @type {Cursor|null} */
let current_cursor = null;
/** @type {Map<string, Element>} */
const _element_map = new Map();

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

    document.addEventListener("mousemove", _update_mouse, true);
    document.addEventListener("mousedown", _update_mouse, true);
    document.addEventListener("mouseup", _update_mouse, true);
    const mouse_keys = /** @type {(keyof typeof mouse)[]}*/ (Object.keys(mouse));

    setInterval(() => {
        if (cursor.needs_update) {
            requestAnimationFrame(render_loop);
        }
    }, 1);

    function render_loop() {
        if (!cursor.needs_update) {
            mouse.delta_x.set_value(0);
            mouse.delta_y.set_value(0);

            let mouse_rerender = false;
            for (let key of mouse_keys) {
                let fv = mouse[key];
                if (fv.needs_rerender()) mouse_rerender = true;
            }

            if (!mouse_rerender) return;
        }

        for (let key of mouse_keys) {
            let fv = mouse[key];
            fv.requested_this_frame = false;
            fv.changed_this_frame = false;
        }

        cursor_reset(cursor);
        current_cursor = cursor;
        frame_cb();
        current_cursor = null;

        if (cursor.node == null) {
            cursor.node = cursor.parent.lastChild;
        } else {
            cursor.node = cursor.node.previousSibling;
        }

        cursor_finalize(cursor);

        for (let i=0; i<cursor.marked_for_remove.length; i++) {
            (/** @type {Element} */(cursor.marked_for_remove[i])).remove();
        }
        cursor.marked_for_remove.length = 0;

        mouse.delta_x.set_value(0);
        mouse.delta_y.set_value(0);

        for (let key of mouse_keys) {
            let fv = mouse[key];
            if (fv.needs_rerender()) request_rerender(cursor);
        }
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
    @arg {Element|string} el
    @arg {Cursor} cursor
    mark_removed(el) is an optimization.
    Think about what happens in our rendering model when we delete an element or
    a text node:
        <button>One</button>
        <button>Two</button> <!-- this one gets deleted -->
        <button>Tri</button>
        <button>444</button>
        <button>Pet</button>

    The cursor skips the "One" button, then it removes the "Two" button and
    creates a new "Tri" in its place. Then it sees the old "Tri", removes it,
    and inserts "444" in its place. Then it sees the old "444", removes it, and
    inserts "Pet" in its place. Finally, it removes the old "Pet".

    Removing "Two" should at most be a single operation, but here, it actually
    triggers 7 operations (remove "Two", insert "Tri", remove "Tri",
    insert "444", remove "444", insert "Pet", remove "Pet"). This only gets
    worse the more elements are in the list.

    To optimize this, we allow user code to mark an element for removal via the
    mark_removed(el) function. Any element marked with this function is removed
    from the DOM after the current frame is finished rendering. The above
    example produces 0 operations if "Two" does not exist, no matter how many
    siblings follow it.

    A similar performance problem exists for insertions, and a similar
    optimization is possible. We could mark positions in the DOM tree where
    elements are going to be inserted in the next frame. Then, when we encounter
    a conflict in those positions, we can just insert an element without
    removing the old one, knowing that the operation must be an insertion.
*/
export function mark_removed(el, cursor=cast_defined("cursor", current_cursor)) {
    if (typeof el == "string") {
        let it = _element_map.get(el);
        if (!it) return;
        el = it;
    }
    cursor.marked_for_remove.push(el);
}

/**
@template T
*/
class Frame_Value {
    /** @arg {T} default_value */
    constructor(default_value) {
        this.value = default_value;
        this.changed_this_frame = false;
    }

    get() {
        this.requested_this_frame = true;
        return this.value;
    }

    /** @arg {T} new_value */
    set_value(new_value) {
        if (this.value != new_value) {
            this.value = new_value;
            this.changed_this_frame = true;
        }
    }

    needs_rerender() {
        if (typeof(this.value) == "boolean") {
            return this.changed_this_frame && this.requested_this_frame;
        }
        return this.requested_this_frame;
    }
}

const mouse = {
    x: new Frame_Value(0),
    y: new Frame_Value(0),
    buttons: new Frame_Value(0),
    left: new Frame_Value(false),
    right: new Frame_Value(false),
    middle: new Frame_Value(false),
    delta_x: new Frame_Value(0),
    delta_y: new Frame_Value(0),
};

/** @arg {MouseEvent} e */
function _update_mouse(e) {
    mouse.x.set_value(e.clientX);
    mouse.y.set_value(e.clientY);

    mouse.delta_x.set_value(mouse.delta_x.value + e.movementX);
    mouse.delta_y.set_value(mouse.delta_y.value + e.movementY);

    mouse.buttons.set_value(e.buttons);
    mouse.left.set_value(!!(e.buttons & 1));
    mouse.right.set_value(!!(e.buttons & 2));
    mouse.middle.set_value(!!(e.buttons & 4));
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
@arg {All_Event_Types} event
@returns {true|undefined}
*/
/**
@template {All_Event_Types} EVENT
@template {any} RETURN
@overload
@arg {EVENT} event
@arg {Odmah_Value_Getter<Guess_Event_Value<EVENT>, RETURN>} value_getter
@returns {RETURN|undefined}
*/
/**
@template {Event_Types<TARGET>} EVENT
@template {EventTarget} TARGET
@overload
@arg {EVENT} event
@arg {TARGET} target
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
@returns {RETURN|undefined}
*/
/**
@template {Event_Types<TARGET>} EVENT
@template [RETURN=boolean]
@template {EventTarget} [TARGET=HTMLElement]
@arg {EVENT} event
@arg {Odmah_Value_Getter<Event_Value<TARGET, EVENT>, RETURN>} [value_getter]
@arg {TARGET} [target]
@arg {Cursor} [cursor]
@returns {RETURN|undefined}
*/
export function hook(
    event,
    // @ts-expect-error
    // The default value getter just returns true, so if somebody were
    // to call hook<string>("click"), typescript would indicate that the
    // returned value is a string, when in reality it will be a boolean.
    // I don't care about this and want to provide a nice default.
    value_getter=default_value_getter,
    target, cursor=get_current_cursor(),
) {
    if (typeof(value_getter) == "object") {
        target = value_getter;
        // @ts-ignore
        value_getter = default_value_getter;
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
@arg {string} id
@returns {HTMLElementTagNameMap[T]}
*/
function get_element(tagname, id) {
    let el = _element_map.get(id);
    if (!el) {
        el = document.createElement(tagname);
        _element_map.set(id, el);
    }
    return /** @type {HTMLElementTagNameMap[T]} */(el);
}

/**
@arg {Node} node
@returns {node is Element}
*/
function is_element(node) {
    return node.nodeType == 1;
}

/**
@template {Element} T
@arg {T} el
@arg {Cursor} cursor
*/
function step_into(el, cursor=get_current_cursor()) {
    if (!el._attrs) el._attrs = new Attrs();
    cursor.last_element = el;
    cursor.parent = el;
    cursor.node = el.firstChild;
    return el;
}

/**
@template {keyof HTMLElementTagNameMap} T
@arg {T} tagname
@arg {string|null} id
@arg {Cursor} cursor
@returns {HTMLElementTagNameMap[T]}
*/
export function container(tagname, id=null, cursor=get_current_cursor()) {
    if (cursor.node == null) {
        /** @type {HTMLElementTagNameMap[T]} */
        let el = id == null ? document.createElement(tagname) : get_element(tagname, id);
        cursor.parent.append(el);
        return step_into(el, cursor);

    } else {

        if (id) {
            let el = get_element(tagname, id);
            if (cursor.node != el) cursor.node.replaceWith(el);
            return step_into(el, cursor);
        }

        if (is_element(cursor.node)) {
            if (tagname != cursor.node.localName) {
                let el = document.createElement(tagname);
                cursor.node.replaceWith(el);
                return step_into(el, cursor);
            }

            return /** @type {HTMLElementTagNameMap[T]} */(step_into(cursor.node, cursor));

        } else /* It is a text node */ {
            let el = document.createElement(tagname);
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
@arg {string|null} id
@arg {Cursor} cursor
@returns {HTMLElementTagNameMap[T]}
*/
export function element(tagname, id=null, cursor=get_current_cursor()) {
    let el = container(tagname, id, cursor);
    step_out(cursor);
    return el;
}
