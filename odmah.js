function assert(cond, msg) {
    if (!cond) {
        throw new Error(`Assertion failed: ${msg}`);
    }
}

// Removes all sibling nodes after the given node.
function remove_after(node) {
    assert(node instanceof Node, "Not a node");
    while (node.nextSibling)
        node.nextSibling.remove();
}

// Removes all child nodes of the given element.
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

let _cursor = cursor_new();
function cursor_new() {
    return {
        parent: document.body,
        // When cursor.node is null, cursor is at the end
        // of the parent element's child list.
        node: null,
        last_element: document.body,
        current_frame: 0
    };
}

function cursor_reset(c) {
    c.parent = document.body;
    c.node = c.parent.firstChild;
    c.last_element = document.body;
    c.current_frame++;
}

let _attrs = new Map();
function attrs_init(el) {
    let attrs = el.attributes;
    let l = attrs.length;
    for (let i=0; i<l; i++) {
        _attrs.set(attrs.item(i).name, "");
    }
}

function attr(name, value) {
    _attrs.set(name, value);
}

function cls(name) {
    let old = _attrs.get("class") ?? "";
    _attrs.set("class", old + " " + name)
}

function style(key, val) {
    let old = _attrs.get("style") ?? "";
    _attrs.set("style", old + key + ":" + val + ";");
}

function _set_attr_from_map(val, attr_name) {
    let old_val = _cursor.last_element.getAttribute(attr_name);
    if (old_val != val)
        _cursor.last_element.setAttribute(attr_name, val);
}

function _attrs_finalize() {
    _attrs.forEach(_set_attr_from_map);
    _attrs.clear();
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

function odmah(frame_cb) {
    function _do_frame() {
        if (!_needs_update) {
            requestAnimationFrame(_do_frame);
            return;
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
        requestAnimationFrame(_do_frame);
    }

    _do_frame();
}

let hooks = new Map();
// NOTE: The hook function only returns a boolean right now (did the event
//      happen since the last frame or not). This can easily be extended to
//      return more information, but I did not care to do that because I have
//      not needed it yet.
function hook(event, el=_cursor.last_element) {
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
        hook = {event, happened_on_frame: -1};
        el_hooks.push(hook);
        el.addEventListener(event, function () {
            request_rerender();
            hook.happened_on_frame = _cursor.current_frame;
        });
    }

    return _cursor.current_frame-1 == hook.happened_on_frame;
}

function element(tagname) {
    let c = _cursor;

    if (c.node == null) {
        _attrs_finalize();
        let el = document.createElement(tagname);
        c.parent.append(el);
        // c.node is still null, no need to update it
        c.last_element = el;
        return el;

    } else {

        // if (c.node instanceof Element) {
        if (c.node.localName) {
            _attrs_finalize();
            if (tagname != c.node.localName) {
                let el = document.createElement(tagname);
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
            let el = document.createElement(tagname);
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
        if (c.node.localName) {
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

    let clicked = hook("click");
    return clicked;
}
