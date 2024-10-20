import { container, step_out, text, attr, style, cls, hook, request_rerender } from "../odmah.mjs";
import { array_remove } from "../modules/utils.mjs";
import { checkbox, button, string_input, button_begin, button_end, $text } from "./shared.mjs";

/** @type {import("../modules/router/routing.mjs").Router} */
let router;

/** @arg {typeof router} main_router */
export function register(main_router) {
    router = main_router;
    router.route("/todos", example_todos);
    router.route("/todos/<todo_id>", example_todo_single);
}

/**
@typedef {{
    id: number;
    title: string;
    done: boolean;
    created: Date;
}} Todo
*/

/** @type {Todo[]} */
const todos = [];
let todo_id = 0;

/** @arg {string} title */
function add_todo(title) {
    todos.push({
        id: ++todo_id,
        title,
        done: false,
        created: new Date()
    });
}

/** @arg {Todo} todo */
function todo_component(todo) {
    container("div"); cls("row border-bottom"); style("height: 2em");
        todo.done = checkbox(todo.done);

        container("span"); cls("flex-dynamic");
            container("a");
                attr("href", `#/todos/${todo.id}`);
                text(todo.title);
            step_out();
            if (todo.done) style("text-decoration: line-through");
        step_out();

        if (todo.done && button("Delete")) {
            array_remove(todos, todo);
        }
    step_out();
}

let new_todo_title = "";
function create_todo_form() {
    container("div"); cls("row wrap"); style("justify-content: center")
        new_todo_title = string_input(new_todo_title);
        cls("flex-dynamic");

        if (hook("keydown", (e) => e.key == "Enter")) {
            add_todo(new_todo_title);
            new_todo_title = "";
            request_rerender();
        }

        if (button_begin()) {
            add_todo(new_todo_title);
            new_todo_title = "";
            request_rerender();
        } cls("row");
            $text.span("+"); style("font-size: 2em; transform: translateY(-1px); line-height: .75");
            $text.span("Create TODO");

        button_end();

        if (new_todo_title.length == 0) attr("disabled");
    step_out();
}

function example_todos() {
    container("div", "example-todos"); cls("column w-half");
        create_todo_form();

        container("div"); cls("column"); style("margin-top: .5em");
            for (let todo of todos) {
                todo_component(todo);
            }
        step_out();
    step_out();
}

function example_todo_single() {
    let todo_id = parseInt(router.params["todo_id"]??'', 10);
    let todo = todos.find(t => t.id == todo_id);
    if (!todo) { router.navigate("#/todos"); return; }

    container("div"); cls("column w-half");
        $text.h2(`TODO: ${todo.title}`);

        $text.time(`Created at: ${todo.created.toLocaleString()}`);
        attr("datetime", todo.created.toISOString());

        container("div"); cls("row"); style("height: 2em");
            container("label"); cls("row flex-dynamic");
                todo.done = checkbox(todo.done);
                text("Done");
            step_out();

            if (todo.done) {
                if (button("Delete")) {
                    array_remove(todos, todo);
                }
            }
        step_out();
    step_out();
}
