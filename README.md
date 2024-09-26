# Odmah

Odmah is an immediate-mode UI framework that runs in the browser, on top of the DOM.

## Reference

### odmah

This function is the main entry point for your application. It starts a render
loop with provided frame callback function. The provided frame callback is called
every time a rerender needs to happen.

This function *does not block*. Instead, it will render a single frame synchronously,
and then use `requestAnimationFrame` to queue rerenders as necessary. After the first
frame is rendered, control is returned to the caller.

> **arguments**
>
> - `frame_cb` `() => void`\
> a function that renders a single frame

> **returns**
>
> N/A

*example 1*
```javascript
odmah(() => {
    container("p");
        text("Hello, sailor!");
    step_out();
});
```

*example 2*
```javascript
let counter = 0;

odmah(() => {
    container("button");
        if (hook("click")) counter++;
        text(`Count: ${counter}`);
    step_out();
});
```

---

### container

This function creates a new element at the cursor, and moves the cursor to the
first position inside of the element.

If an element of the given type already exists at the cursor, the cursor is simply
moved inside of that instead.

Providing the `id` argument will cache the created element and ensure that the
same element is (re)used whenever the same `id` is requested.

> **note 1**
>
> Ids are not the same as the [element id property] -- if you want to set that property,
> use `attr("id", "my_element_id")`.

> **note 2**
>
> Once you create an element with some `id`, the `tagname` of that element can never
> change again. More specifically:
>
> ```javascript
> let a = container("div", "id_1");
> let b = container("span", "id_1");
> ```
>
> Here, the first line creates a div element and associates it with the id "id_1".
> The second line then requests a span element with that same id -- however, since
> that id is already bound to a div element, that's what the element that we get.
>
> `a` and `b` refer to the same element!

[element id property]: https://developer.mozilla.org/en-US/docs/Web/API/Element/id

> **arguments**
>
> - `tagname` `string`\
> the tag name of the container element to create
> - `id` `string|null = null`\
> the unique id for this element


> **returns**
>
> ```
> Element (specific subtype will depend on the "tagname" parameter)
> ```

*example 1*
```javascript
container("div");
    text("Hello, sailor!");
step_out();
```
Here, a `div` element is created with the text "Hello, sailor!" inside of it.

*example 2*
```javascript
if (Math.random() > 0.5) {
    container("div");
        text("Foo");
    step_out();
}

container("div", "special_div");
    text("Hello, sailor!");
step_out();
```
In this example, the first div only has a 50% chance of being created, but the
second one will always be created.

Normally, in this configuration, if the first div exists on one frame, and then
disappears on the next frame, the *second* div element will actually be destroyed,
and the text of the first div element will be changed to "Hello, sailor!".

However, *because* we have specified a specific id ("special_div") for the second
div, this behavior is prevented -- instead, the second div will be moved in the
DOM to where the first one is currently, and the first one will be removed later.

---

### step_out

This function moves the cursor into the parent of the last inserted element, to
the spot right after the last inserted element.

For example, if the cursor is in the following position:
```html
<body>
    <div>
        <input />
        <!-- cursor -->
    </div>
    <span>Hello, sailor!</span>
</body>
```

calling `step_out` will move the cursor out of the div element and put it between
the div and the span.

> **arguments**
>
> N/A

> **returns**
>
> N/A

*example*
```javascript
container("div");
    element("input");
step_out();

container("span");
    text("Hello, sailor!");
step_out();
```

This code creates html identical to the example above. Additionally, the first call
to `step_out` in this code is equivalent to the call to `step_out` described in the
example above.

---

### element

This function is a convenience method for inserting elements that we do not intend
to have children (or that can not have children in the first place).

A call to `element` is functionally equivalent to a call to `container` with the
same arguments, followed immediately by a call to `step_out`.

> **arguments**
>
> - `tagname` `string`\
> the tag name of the element to create
> - `id` `string|null = null`\
> the unique id for this element

> **returns**
>
> ```
> Element (specific subtype will depend on the "tagname" parameter)
> ```

*example*
```javascript
container("label");
    text("Email");
    element("input");
    attr("type", "email");
step_out();
```
This will create a label with an input element inside of it.

---

### text

This function inserts text inside of the last inserted element.

> **arguments**
>
> - `text` `string`\
> the text to insert

> **returns**
>
> ```
> Text (https://developer.mozilla.org/en-US/docs/Web/API/Text)
> ```

*example*
```javascript
container("button");
    text("This is the label of the button.");
step_out();
```

---

### attr

This function sets an attribute on the last inserted element.

> **arguments**
>
> - `attribute` `string`\
> the name of the attribute to set
> - `value` `any = ""`\
> the value to set

> **returns**
>
> N/A

*example*
```javascript
element("canvas");
attr("id", "app-canvas");
attr("width", 600);
attr("height", 400);
```
This will create a canvas element with the provided attributes. The resulting HTML
is:
```html
<canvas id="app-canvas" width="600" height="400">
</canvas>
```

---

### get_attr

This function gets the value of an attribute on the last inserted element.

> **arguments**
>
> - `attribute` `string`\
> the name of the attribute to get

> **returns**
>
> ```
> any
> ```

*example*
```javascript
element("input");
attr("type", "number");
let type = get_attr("number");
```

---

### cls

This function adds a class to the last inserted element's class list. Multiple
calls to this will concatenate all the provided class names together with spaces.

Multiple class names can be set in a single call to `cls` by separating them with
spaces.

> **arguments**
>
> - `name` `string`\
> the class name to add

> **returns**
>
> N/A

*example*
```javascript
container("div"); cls("flex flex-col gap-2");
    for (let i=0; i<10; i++) {
        element("input");
        attr("placeholder", `Input ${i+1}`);
    }
step_out();
```

This code creates a div with the provided classes applied, and with 10 input elements
inside of it.

---

### style

This function sets inline styles on the last inserted element. If this is called
multiple times for a single element, the provided styles are concatenated into a
single style before updating the element's inline styles.

> **arguments**
>
> - `css` `string`\
> css code to be added to inline styles of the last inserted element

> **returns**
>
> N/A


*example 1*
```javascript
container("button");
    if (hook("click")) count++;
    text(`Count: ${count}`);
    style(`
        background: red;
        color: white;
    `);

    if (count%2 == 0) style("background: blue;");
step_out();
```

The above code creates a button with a count displayed. The button is blue if the
count is odd, and red if it is even.

*example 2*
```javascript
container("button");
    if (hook("click")) count++;
    text(`Count: ${count}`);
    style(`
        color: white;
        background:
    `);
    if (count%2 == 0) style("blue;");
    else style("red;");
step_out();
```

This code achieves the same thing as the first example, because intermediate calls
to `style` can have partially complete css statements -- as long as the concatenated
css is valid, everything will work correctly.

*example 3*
```javascript
container("button");
    if (hook("click")) count++;
    text(`Count: ${count}`);
    style(`
        color: white;
        background: ${count%2== 0 ? 'blue' : 'red'};
    `);
step_out();
```

This code also achieves the same result as the first example -- template strings
can be used to achieve dynamic element styles.

---

### set_style

This function overrides inline styles for the last inserted element. If it is called
multiple times for a single element, only the styles provided to the last call will
be applied.

> **arguments**
>
> - `css` `string`\
> css code to be applied as the inline style of the last inserted element

> **returns**
>
> N/A

*example*
```javascript
container("button");
    set_style(`
        background: red;
        color: yellow;
    `);

    set_style(`
        background: blue;
    `);

    text("Hello, sailor!");
step_out();
```
The created button will have a blue background -- the yellow color will *not* be
applied.

---

### css

This function appends to a global stylesheet. It supports a special keyword (`@this`)
which can be used as a selector, or as an animation name.

Used as a selector, `@this` refers to the last inserted element at the time of the
call to `css`. Used in other places, it allows us to create identifiers that are unique
to the last inserted element at the time of the call to `css`.

> **arguments**
>
> - `css` `string`\
> css code to appended to the global stylesheet

> **returns**
>
> N/A

*example*
```javascript
container("button");
    css(`
        @this {
            background: red;
            color: white;
            &:hover { background: blue; }
        }
    `);
    text("Hello, sailor!");
step_out();
```

This code creates a button and appends a style to the global stylesheet. The button
is red with white text, but the background turns blue when hovered.

---

### get_element_state

This function creates/gets state that is bound to an element. The state is persistent
across rerenders.

The first call to this function for some element will create and return an empty
object associated to that element. Every subsequent call to this function for that
element will return that same object.

> **arguments**
>
> - `element` `Element`\
> the element to get the state of

> **returns**
>
> ```
> Record<string, any>
> ```

*example*
```javascript
let input = element("input");
let input_state = get_element_state(input);
if (hook("input")) input_state["touched"] = true;
if ("touched" in input_state) cls("touched");
```

This function creates an input element that has the "touched" class set after the
user first interacts with it.

This is done by creating a state object and setting the "touched" property on it
when the "input" event is triggered. Since the object is persistent across frames,
we can simply check for the existence of the "touched" property before applying the
"touched" class.

---

### mark_removed

This function gives a hint to the framework that an element would be removed on the
next rerender. It allows the framework to skip some work by removing the element
explicitly at the end of the current frame.

> **arguments**
>
> - `element` `Element`\
> the element to mark as removed

> **returns**
>
> N/A

*example*
```javascript
const buttons = ["foo", "bar", "baz"];
odmah(() => {

    let button_to_remove = null;
    for (let button of buttons) {
        let el = container("button");
            text(button);
            if (hook("click")) {
                button_to_remove = button;
                mark_removed(el);
            }
        step_out();
    }

    if (button_to_remove) {
        let idx = buttons.indexOf(button_to_remove);
        buttons.splice(idx, 1);
    }
});
```
This code creates a list of three buttons. Clicking any button removes it from the
list.

---

### hook

This function returns a value on the frame when the specified event is triggered
on the provided element. On frames when the event is not triggered, the function
returns `undefined`.

The returned value depends on the `value_getter` argument. If this function is not
provided, the returned value will simply be `true`.

The event target defaults to the last inserted element if not provided.

> **note**
>
> The same hook applied to the same element multiple times will be deduplicated.
> In other words, it is perfectly fine to do something like the following:
> ```javascript
> container("button");
> text(`Hello! Count: ${count}`);
> if (hook("click")) console.log("The button was clicked!");
> if (hook("click")) count++;
> step_out();
> ```
> Only a single event listener will be applied to the button element and the event
> will only be processed once, despite `hook` being called twice.

> **arguments**
>
> - `event` `string`\
> the name of the event
> - `value_getter` `(e: Event)=>RETURN = ()=>true`\
> the callback that determines the return value. The type of the `e` argument depends
> on the `event` and `target` arguments. For example, if the target is an element
> and the event is "click", the type of `e` will be `MouseEvent`. If the target is
> the `window` object and the event is "copy", the type of `e` will be `ClipboardEvent`.
> - `target` `EventTarget`\
> an element or other event target

> **returns**
>
> ```
> RETURN|undefined
> ```

*example 1*
```javascript
container("button");
    text("Click me!");
    if (hook("click")) console.log("The button was clicked!");
step_out();
```

This code creates a button and logs "The button was clicked!" to the console whenever
the button is clicked.

*example 2*
```javascript
function get_filenames(e) {
    e.preventDefault();
    let filenames = [];
    [...ev.dataTransfer.files].forEach(file => {
        filenames.push(file.name);
    });
    return filenames;
}

container("div");
    text("Drop files here!");
    let dropped_filenames = hook("drop", get_filenames);
    if (dropped_filenames != undefined) {
        console.log(dropped_filenames);
    }
step_out();
```

This code creates a div that logs to the console the names of the files dropped
into it.

