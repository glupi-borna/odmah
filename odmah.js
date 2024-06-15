"use strict"

/**
    @arg {string} msg
    @return {asserts cond is true}
*/
function assert(cond, msg) {
    if (!cond) {
        throw new Error(`Assertion failed: ${msg}`);
    }
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

/**
I am kicking around the idea of "subcursors". You could imagine spawning a
cursor elsewhere in the page (probably where you've already passed
with the main cursor) and opting to render there. This is the only reason that
_cursor is not a singleton -- although, I have not been super careful about this
and subsequently have written most of the code in the framework to treat _cursor
as a singleton.

Oh well.
*/
let _cursor = cursor_new();
function cursor_new() {
    return {
        parent: document.body,
        // When cursor.node is null, cursor is at the end
        // of the parent element's child list.
        node: null,
        last_element: document.body,
        current_frame: 0,
        stepped_in: true
    };
}

function cursor_reset(c) {
    c.parent = document.body;
    c.node = c.parent.firstChild;
    c.last_element = document.body;
    c.stepped_in = true;
    c.current_frame++;
}

let _attrs = {};
let _style_str = "";
let _class_str = "";

function attr(name, value="") {
    _attrs[name] = value;
}

function cls(name) {
    _class_str += name + " ";
}

function style(key, val) {
    _style_str += key + ":" + val + ";";
}

function styles(css) {
    _style_str += css;
}

function get_attributes(el) {
    if (el._attrs == undefined) el._attrs = {};
    return el._attrs;
}

function _attrs_finalize() {
    let el = _cursor.last_element;

    if (_style_str) {
        _attrs.style = _style_str;
        _style_str = "";
    }

    if (_class_str) {
        _attrs["class"] = _class_str;
        _class_str = "";
    }

    let attrs = get_attributes(el);

    for (let key in attrs) {
        let attr = attrs[key];

        let val = _attrs[key];
        if (val === undefined) {
            el.removeAttribute(key);
            delete attrs[key];
        } else if (val != attr) {
            el.setAttribute(key, val);
            attrs[key] = val;
        }
        delete _attrs[key];
    }

    for (let key in _attrs) {
        el.setAttribute(key, _attrs[key]);
        attrs[key] = _attrs[key];
        delete _attrs[key];
    }
}

function cursor_finalize(c) {
    _attrs_finalize();
    while (c.node) {
        remove_after(c.node);
        c.node = c.parent;
        if (c.node)
            c.parent = c.node.parentElement;
    }
}

/**
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
const marked_for_remove = [];
function mark_removed(el) {
    marked_for_remove.push(el);
}

class Frame_Value {
    constructor(default_value) {
        this.value = default_value;
        this.changed_this_frame = false;
    }

    get() {
        this.requested_this_frame = true;
        return this.value;
    }

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

function odmah(frame_cb) {
    document.addEventListener("mousemove", _update_mouse, true);
    document.addEventListener("mousedown", _update_mouse, true);
    document.addEventListener("mouseup", _update_mouse, true);

    function _do_frame() {
        if (!_needs_update) {
            mouse.delta_x.set_value(0);
            mouse.delta_y.set_value(0);

            let mouse_rerender = false;
            for (let key in mouse) {
                let fv = mouse[key];
                if (fv.needs_rerender()) mouse_rerender = true;
            }

            if (!mouse_rerender) {
                requestAnimationFrame(_do_frame);
                return;
            }
        }

        for (let key in mouse) {
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
            marked_for_remove[i].remove();
        }
        marked_for_remove.length = 0;

        record_frame_time(performance.now() - start);
        mouse.delta_x.set_value(0);
        mouse.delta_y.set_value(0);

        for (let key in mouse) {
            let fv = mouse[key];
            if (fv.needs_rerender()) request_rerender();
        }

        requestAnimationFrame(_do_frame);
    }

    _do_frame();
}

function _hook_default() { return true; }
let hooks = new Map();
// NOTE: The hook function only returns a boolean right now (did the event
//      happen since the last frame or not). This can easily be extended to
//      return more information, but I did not care to do that because I have
//      not needed it yet.
function hook(event, value_getter=_hook_default, el=_cursor.last_element) {
    let el_hooks = hooks.get(el);
    let hook = null;

    if (el_hooks) {
        for (let i=0; i<el_hooks.length; i++) {
            let h = el_hooks[i];
            if (h.event != event) continue;
            hook = h;
            break;
        }
    } else {
        el_hooks = [];
        hooks.set(el, el_hooks);
    }

    if (!hook) {
        hook = {
            event,
            happened_on_frame: -1,
            value: undefined
        };
        el_hooks.push(hook);
        el.addEventListener(event, function (e) {
            request_rerender();
            hook.value = value_getter(e);
            hook.happened_on_frame = _cursor.current_frame;
        });
    }

    if (_cursor.current_frame-1 == hook.happened_on_frame) {
        return hook.value;
    }
    return undefined;
}

const _element_map = new Map();

/**
    @template {string} T
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
    return el;
}

/**
    @template {string} T
    @arg {T} tagname
    @arg {string|null} id
    @returns {HTMLElementTagNameMap[T]}
*/
function element(tagname, id=null) {
    let c = _cursor;

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

        // if (c.node instanceof Element) {
        if (c.node.nodeType == 1) {
            _attrs_finalize();
            if (tagname != c.node.localName) {
                let el = document.createElement(tagname, id);
                c.node.replaceWith(el);
                c.node = el.nextSibling;
                c.last_element = el;
                return el;
            }
            let el = c.node;
            c.node = el.nextSibling;
            c.last_element = el;
            return el;

        // } else if (c.node instanceof Text) {
        } else {
            let el = document.createElement(tagname, id);
            c.node.replaceWith(el);
            c.node = el.nextSibling;
            c.last_element = el;
            return el;
        }
    }
}

function text(txt) {
    let c = _cursor;

    if (c.node == null) {
        let t = new Text(txt);
        c.parent.append(t);
        // c.node is still null, no need to update it
        return t;

    } else {

        // if (c.node instanceof Element) {
        if (c.node.nodeType == 1) {
            let t = new Text(txt);
            c.node.replaceWith(t);
            c.node = t.nextSibling;
            return t;

        // } else if (c.node instanceof Text) {
        } else {
            if (c.node.data != txt)
                c.node.data = txt;
            c.node = c.node.nextSibling;
            return c.node;
        }
    }
}

function container(tagname, id=null) {
    element(tagname, id);
    step_in();
}

function step_in() {
    let c = _cursor;
    c.parent = c.last_element;
    c.node = c.last_element.firstChild;
}

function step_out() {
    let c = _cursor;
    assert(c.parent, "Stepping out into nothing!");
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

function Button(label) {
    const button = element("button");
    step_in();
    text(label);
    step_out();

    let clicked = hook("mousedown");
    return clicked;
}
