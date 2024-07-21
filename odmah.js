"use strict"

/**
@arg {any} cond
@arg {string} msg
@return {asserts cond is true}
*/
function assert(cond, msg) {
    if (!cond) {
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
@template T
@arg {T|undefined|null} obj
@arg {string} msg
@return {asserts obj is T}
*/
function assert_defined(obj, msg) {
    if (obj == undefined) {
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
@template T
@arg {string} name
@arg {T|undefined|null} obj
@return {T}
*/
function cast_defined(name, obj) {
    assert_defined(obj, `${name} is undefined!`);
    return obj;
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
    @arg {Element} el
    @desc Removes all child nodes of the given element.
*/
function remove_children(el) {
    assert(el instanceof Element, "Not an element");
    while (el.firstChild)
        el.firstChild.remove();
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
            We use a cursor to rendering each frame. The cursor represents a
            place in the DOM tree. It starts each frame at the start of the
            document body.

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

/**
_needs_update is an optimisation. Most frames, nothing has changed since the
last frame, so we can skip a lot of work if we know that nothing has changed.
This is essentially a "dirty" flag. We only perform the frame callback in
`odmah` if it is set to `true`.
We set _needs_update to true whenever an event listener (set up by `hook`) is
triggered.
*/
let _needs_update = true;

/**
request_rerender() is a neccessary evil when using the _needs_update
optimisation - if our state changes out of band (i.e., not via a `hook` event
listener), we will not rerender. This is an escape hatch that allows us to
explicitly set the _needs_update flag.
*/
function request_rerender() {
    _needs_update = true;
}

/** @typedef {ReturnType<typeof cursor_new>} Cursor */

let _cursor = cursor_new();
function cursor_new() {
    return {
        /** @type {Element} */
        parent: document.body,
        /** @type {Element} */
        root: document.body,
        // When cursor.node is null, cursor is at the end
        // of the parent element's child list.
        /** @type {ChildNode|null} */
        node: null,
        /** @type {Element} */
        last_element: document.body,
        /** @type {string|null} */
        last_id: null,
        current_frame: 0,
        stepped_in: true
    };
}

/** @arg {Cursor} c */
function cursor_reset(c) {
    c.parent = document.body;
    c.node = c.parent.firstChild;
    c.root = document.body;
    c.last_element = document.body;
    c.stepped_in = true;
    c.current_frame++;
}

/**
@type {Partial<Record<string, any>>}
Stores the current element's attributes.
*/
let _attrs = {};
/** Stores the current element's style. */
let _style_str = "";
/** Stores the current element's class. */
let _class_str = "";

/**
@arg {string} name
@arg {any} value
Sets an attribute on the current element.
*/
function attr(name, value="") {
    _attrs[name] = value;
}

/**
@arg {string} name
Sets a class on the current element;
*/
function cls(name) {
    _class_str += name + " ";
}

/**
@arg {string} name
Gets the value of an attribute on the current element.
*/
function get_attr(name) {
    let previous_attrs = _get_attributes(_cursor.last_element);
    if (name in previous_attrs) return previous_attrs[name];
    return _attrs[name];
}

/**
@arg {string} css
Appends styles to the current element.
*/
function style(css) {
    _style_str += css;
}

/**
@arg {string} css
Sets the style string of the current element.
*/
function set_style(css) {
    _style_str = css;
}


/**
@typedef {
    Element & {
        _attrs?: Partial<Record<string, unknown>>;
        _odmah_state?: Partial<Record<string, unknown>>;
    }
} Odmah_Element
*/

/**
@arg {Odmah_Element} el
@returns {Partial<Record<string, any>>}
Gets the previous attributes set on the element.
*/
function _get_attributes(el) {
    if (el._attrs == undefined) el._attrs = {};
    return el._attrs;
}

/**
@arg {Odmah_Element} el
@returns {Partial<Record<string, any>>}
Gets the permanent element state.
*/
function get_element_state(el) {
    if (el._odmah_state == undefined) el._odmah_state = {};
    return el._odmah_state;
}

function _attrs_finalize() {
    let el = _cursor.last_element;

    if (_style_str) {
        _attrs["style"] = _style_str;
        _style_str = "";
    }

    if (_class_str) {
        _attrs["class"] = _class_str;
        _class_str = "";
    }

    let previous_attrs = _get_attributes(el);

    for (let key in previous_attrs) {
        let attr = previous_attrs[key];

        let val = _attrs[key];
        if (val === undefined) {
            el.removeAttribute(key);
            delete previous_attrs[key];
        } else if (val != attr) {
            el.setAttribute(key, val);
            previous_attrs[key] = val;
        }
        delete _attrs[key];
    }

    for (let key in _attrs) {
        el.setAttribute(key, _attrs[key]);
        previous_attrs[key] = _attrs[key];
        delete _attrs[key];
    }
}

/** @arg {Cursor} c */
function cursor_finalize(c) {
    _attrs_finalize();
    while (c.node) {
        remove_after(c.node);
        if (c.node == c.root) return;
        c.node = c.parent;
        if (c.node) {
            c.parent = cast_defined(
                "Parent element of cursor node",
                c.node.parentElement
            );
        }
    }
}

/** @type {Element[]} */
const marked_for_remove = [];

/**
    @arg {Element|string} el
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
function mark_removed(el) {
    if (typeof el == "string") {
        let it = _element_map.get(el);
        if (!it) return;
        el = it;
    }
    marked_for_remove.push(el);
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
function odmah(frame_cb) {
    document.addEventListener("mousemove", _update_mouse, true);
    document.addEventListener("mousedown", _update_mouse, true);
    document.addEventListener("mouseup", _update_mouse, true);

    const mouse_keys = /** @type {(keyof typeof mouse)[]}*/ (Object.keys(mouse));

    function _do_frame() {
        if (!_needs_update) {
            mouse.delta_x.set_value(0);
            mouse.delta_y.set_value(0);

            let mouse_rerender = false;
            for (let key of mouse_keys) {
                let fv = mouse[key];
                if (fv.needs_rerender()) mouse_rerender = true;
            }

            if (!mouse_rerender) {
                requestAnimationFrame(_do_frame);
                return;
            }
        }

        for (let key of mouse_keys) {
            let fv = mouse[key];
            fv.requested_this_frame = false;
            fv.changed_this_frame = false;
        }

        let start = performance.now();
        cursor_reset(_cursor);
        _needs_update = false;
        frame_cb();
        if (_cursor.node == null) {
            _cursor.node = _cursor.parent.lastChild;
        } else {
            _cursor.node = _cursor.node.previousSibling;
        }
        cursor_finalize(_cursor);

        for (let i=0; i<marked_for_remove.length; i++) {

            (/** @type {Element} */(marked_for_remove[i])).remove();
        }
        marked_for_remove.length = 0;

        record_frame_time(performance.now() - start);
        mouse.delta_x.set_value(0);
        mouse.delta_y.set_value(0);

        for (let key of mouse_keys) {
            let fv = mouse[key];
            if (fv.needs_rerender()) request_rerender();
        }

        requestAnimationFrame(_do_frame);
    }

    _do_frame();
}

function _hook_default() { return true; }

/**
@template [T=unknown]
@typedef Hook_Data
@prop {string} event
@prop {number} happened_on_frame
@prop {T|undefined} value
*/

/** @type {Map<EventTarget, Hook_Data[]>} */
let hooks = new Map();

/**
@template {keyof HTMLElementEventMap} EVENT
@template RETURN
@arg {EVENT} event
@arg {(e: HTMLElementEventMap[EVENT]) => RETURN} [value_getter]
@arg {EventTarget} [el]
@returns {RETURN|undefined}
*/
function hook(
    event,
    // @ts-expect-error
    // The default value getter just returns true, so if somebody were
    // to call hook<string>("click"), typescript would indicate that the
    // returned value is a string, when in reality it will be a boolean.
    // I don't care about this and want to provide a nice default.
    value_getter=_hook_default,
    el=_cursor.last_element
) {
    let el_hooks = hooks.get(el);
    /** @type {Hook_Data<RETURN>|undefined} */
    let hook = undefined;

    let event_key = event + "::" + value_getter;

    if (el_hooks) {
        for (let i=0; i<el_hooks.length; i++) {
            // This cast is technically not correct, but we check it with
            // `h.event != event.key` afterwards.
            let h = /** @type {Hook_Data<RETURN>} */(el_hooks[i]);
            if (h.event != event_key) continue;
            hook = h;
            break;
        }
    } else {
        el_hooks = [];
        hooks.set(el, el_hooks);
    }

    if (!hook) {
        hook = {
            event: event_key,
            happened_on_frame: -1,
            value: undefined
        };
        const h = hook;
        el_hooks.push(hook);
        el.addEventListener(
            event,
            function (e) {
                request_rerender();
                // @ts-expect-error It is hard to type this properly, but it
                // is correct.
                h.value = value_getter(e);
                h.happened_on_frame = _cursor.current_frame;
            }
        );
    }

    if (_cursor.current_frame-1 == hook.happened_on_frame) {
        return hook.value;
    }
    return undefined;
}

/** @type {Map<string, Element>} */
const _element_map = new Map();

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
function _is_element(node) {
    return node.nodeType == 1;
}

/**
@template {keyof HTMLElementTagNameMap} T
@arg {T} tagname
@arg {string|null} id
@returns {HTMLElementTagNameMap[T]}
*/
function element(tagname, id=null) {
    let c = _cursor;
    c.last_id = id;

    if (c.node == null) {
        _attrs_finalize();
        let el = id==null ? document.createElement(tagname) : get_element(tagname, id);
        c.parent.append(el);
        // c.node is still null, no need to update it
        c.last_element = el;
        if (id) _element_map.set(id, el);
        return el;

    } else {

        if (id) {
            _attrs_finalize();
            let el = get_element(tagname, id);
            if (c.node != el) {
                c.node.replaceWith(el);
            }
            c.node = el.nextSibling;
            c.last_element = el;
            return el;
        }

        if (_is_element(c.node)) {
            _attrs_finalize();
            if (tagname != c.node.localName) {
                let el = document.createElement(tagname);
                c.node.replaceWith(el);
                c.node = el.nextSibling;
                c.last_element = el;
                return el;
            }
            let el = /** @type {HTMLElementTagNameMap[T]} */(c.node);
            c.node = el.nextSibling;
            c.last_element = el;
            return el;

        } else /* It is a text node */ {
            let el = document.createElement(tagname);
            c.node.replaceWith(el);
            c.node = el.nextSibling;
            c.last_element = el;
            return el;
        }
    }
}

/** @arg {string} txt */
function text(txt) {
    let c = _cursor;

    if (c.node == null) {
        let t = new Text(txt);
        c.parent.append(t);
        return t;

    } else {
        const node = /** @type {Text|Element} */(c.node);

        if (_is_element(node)) {
            let t = new Text(txt);
            node.replaceWith(t);
            c.node = t.nextSibling;
            return t;

        } else /* It is a text node */ {
            if (node.data != txt)
                node.data = txt;
            c.node = node.nextSibling;
            return c.node;
        }
    }
}

function step_in() {
    let c = _cursor;
    c.parent = c.last_element;
    c.node = c.last_element.firstChild;
}

function step_out() {
    let c = _cursor;
    assert(c.parent, "Stepping out into nothing!");
    assert(c.parent.parentElement, "Stepping out into nothing!");
    if (c.node) {
        if (c.node.previousSibling) {
            remove_after(c.node.previousSibling);
        } else {
            remove_children(c.parent);
        }
    }
    c.node = c.parent.nextSibling;
    c.parent = c.parent.parentElement;
}

/**
@template {keyof HTMLElementTagNameMap} T
@arg {T} tagname
@arg {string|null} id
@returns {HTMLElementTagNameMap[T]}
*/
function container(tagname, id=null) {
    let el = element(tagname, id);
    step_in();
    return el;
}

/**
@arg {MouseEvent} e
@arg {number} button
*/
function _handle_mouse_button_impl(e, button) { return e.button == button; }

/** @arg {MouseEvent} e */
function _button_is_left(e) { return _handle_mouse_button_impl(e, 0); }
/** @arg {MouseEvent} e */
function _button_is_right(e) { return _handle_mouse_button_impl(e, 2); }
/** @arg {MouseEvent} e */
function _button_is_middle(e) { return _handle_mouse_button_impl(e, 1); }

/** @arg {Event} e */
function prevent_default(e) {
    e.preventDefault();
}

/** @arg {Element} el */
function mouse_left_pressed(el=_cursor.last_element) {
    return hook("mousedown", _button_is_left, el) ?? false;
}

/** @arg {Element} el */
function mouse_left_released(el=_cursor.last_element) {
    return hook("mouseup", _button_is_left, el) ?? false;
}

/** @arg {Element} el */
function mouse_left_clicked(el=_cursor.last_element) {
    return hook("click", _button_is_left, el) ?? false;
}

/** @arg {Element} el */
function mouse_right_pressed(el=_cursor.last_element) {
    hook("contextmenu", prevent_default, el);
    return hook("mousedown", _button_is_right, el) ?? false;
}

/** @arg {Element} el */
function mouse_right_released(el=_cursor.last_element) {
    hook("contextmenu", prevent_default, el);
    return hook("mouseup", _button_is_right, el) ?? false;
}

/** @arg {Element} el */
function mouse_right_clicked(el=_cursor.last_element) {
    hook("contextmenu", prevent_default, el);
    return hook("click", _button_is_right, el) ?? false;
}

/** @arg {Element} el */
function mouse_middle_pressed(el=_cursor.last_element) {
    return hook("mousedown", _button_is_middle, el) ?? false;
}

/** @arg {Element} el */
function mouse_middle_released(el=_cursor.last_element) {
    return hook("mouseup", _button_is_middle, el) ?? false;
}

/** @arg {Element} el */
function mouse_middle_clicked(el=_cursor.last_element) {
    return hook("click", _button_is_middle, el) ?? false;
}

/** @arg {WheelEvent} e */
function _get_delta_y(e) { return e.deltaY; }

/** @arg {WheelEvent} e */
function _get_delta_x(e) { return e.deltaY; }

/** @arg {Element} el */
function wheel_y(el=_cursor.last_element) {
    return hook("wheel", _get_delta_y, el) ?? 0;
}

/** @arg {Element} el */
function wheel_x(el=_cursor.last_element) {
    return hook("wheel", _get_delta_x, el) ?? 0;
}

/**
@typedef Hovered_State
@param {boolean} is_hovered
*/

/** @arg {Element} el */
function hovered(el=_cursor.last_element) {
    let state = /** @type {Partial<Hovered_State>} */(get_element_state(el));
    if (hook("mouseover")) state.is_hovered = true;
    if (hook("mouseout")) state.is_hovered = false;
    return state.is_hovered ?? false;
}

/** @arg {string} label */
function Button(label) {
    container("button");
    text(label);
    step_out();
    // We trigger on press instead of on click, Carmack-style.
    return mouse_left_pressed();
}
