// NOTE: Experimental, likely to change

import { get_current_cursor, hook, get_element_state } from "../odmah.mjs";
import { prevent_default } from "./modifiers.mjs";

/**
@arg {MouseEvent} e
@arg {number} button
*/
function handle_mouse_button_impl(e, button) { return e.button == button; }

/**
@arg {MouseEvent} e
@arg {number} button
*/
function handle_mouse_button_impl_stop(e, button) {
    e.stopPropagation();
    return e.button == button;
}

/** @arg {MouseEvent} e */
function button_is_left(e) { return handle_mouse_button_impl(e, 0); }
/** @arg {MouseEvent} e */
function button_is_right(e) { return handle_mouse_button_impl(e, 2); }
/** @arg {MouseEvent} e */
function button_is_middle(e) { return handle_mouse_button_impl(e, 1); }

/** @arg {MouseEvent} e */
function button_is_left_stop(e) { return handle_mouse_button_impl_stop(e, 0); }
/** @arg {MouseEvent} e */
function button_is_right_stop(e) { return handle_mouse_button_impl_stop(e, 2); }
/** @arg {MouseEvent} e */
function button_is_middle_stop(e) { return handle_mouse_button_impl_stop(e, 1); }

/** @arg {Element} el */
export function mouse_left_pressed(el=get_current_cursor().last_element) {
    return hook("mousedown", button_is_left, el) ?? false;
}

/** @arg {Element} el */
export function mouse_left_released(el=get_current_cursor().last_element) {
    return hook("mouseup", button_is_left, el) ?? false;
}

/** @arg {Element} el */
export function mouse_left_clicked(el=get_current_cursor().last_element) {
    return hook("click", button_is_left, el) ?? false;
}

/** @arg {Element} el */
export function mouse_right_pressed(el=get_current_cursor().last_element) {
    hook("contextmenu", prevent_default, el);
    return hook("mousedown", button_is_right, el) ?? false;
}

/** @arg {Element} el */
export function mouse_right_released(el=get_current_cursor().last_element) {
    hook("contextmenu", prevent_default, el);
    return hook("mouseup", button_is_right, el) ?? false;
}

/** @arg {Element} el */
export function mouse_right_clicked(el=get_current_cursor().last_element) {
    hook("contextmenu", prevent_default, el);
    return hook("click", button_is_right, el) ?? false;
}

/** @arg {Element} el */
export function mouse_middle_pressed(el=get_current_cursor().last_element) {
    return hook("mousedown", button_is_middle, el) ?? false;
}

/** @arg {Element} el */
export function mouse_middle_released(el=get_current_cursor().last_element) {
    return hook("mouseup", button_is_middle, el) ?? false;
}

/** @arg {Element} el */
export function mouse_middle_clicked(el=get_current_cursor().last_element) {
    return hook("click", button_is_middle, el) ?? false;
}

/** @arg {Element} el */
export function mouse_sp_left_pressed(el=get_current_cursor().last_element) {
    return hook("mousedown", button_is_left_stop, el) ?? false;
}

/** @arg {Element} el */
export function mouse_sp_left_released(el=get_current_cursor().last_element) {
    return hook("mouseup", button_is_left_stop, el) ?? false;
}

/** @arg {Element} el */
export function mouse_sp_left_clicked(el=get_current_cursor().last_element) {
    return hook("click", button_is_left_stop, el) ?? false;
}

/** @arg {Element} el */
export function mouse_sp_right_pressed(el=get_current_cursor().last_element) {
    hook("contextmenu", prevent_default, el);
    return hook("mousedown", button_is_right_stop, el) ?? false;
}

/** @arg {Element} el */
export function mouse_sp_right_released(el=get_current_cursor().last_element) {
    hook("contextmenu", prevent_default, el);
    return hook("mouseup", button_is_right_stop, el) ?? false;
}

/** @arg {Element} el */
export function mouse_sp_right_clicked(el=get_current_cursor().last_element) {
    hook("contextmenu", prevent_default, el);
    return hook("click", button_is_right_stop, el) ?? false;
}

/** @arg {Element} el */
export function mouse_sp_middle_pressed(el=get_current_cursor().last_element) {
    return hook("mousedown", button_is_middle_stop, el) ?? false;
}

/** @arg {Element} el */
export function mouse_sp_middle_released(el=get_current_cursor().last_element) {
    return hook("mouseup", button_is_middle_stop, el) ?? false;
}

/** @arg {Element} el */
export function mouse_sp_middle_clicked(el=get_current_cursor().last_element) {
    return hook("click", button_is_middle_stop, el) ?? false;
}

/** @arg {WheelEvent} e */
export function _get_delta_y(e) { return e.deltaY; }

/** @arg {WheelEvent} e */
export function _get_delta_x(e) { return e.deltaY; }

/** @arg {Element} el */
export function wheel_y(el=get_current_cursor().last_element) {
    return hook("wheel", _get_delta_y, el) ?? 0;
}

/** @arg {Element} el */
export function wheel_x(el=get_current_cursor().last_element) {
    return hook("wheel", _get_delta_x, el) ?? 0;
}

/**
@typedef {{ is_hovered: boolean }} Hovered_State
*/

/** @arg {Element} el */
export function hovered(el=get_current_cursor().last_element) {
    let state = /** @type {Partial<Hovered_State>} */(get_element_state(el));
    if (hook("mouseover")) state.is_hovered = true;
    if (hook("mouseout")) state.is_hovered = false;
    return state.is_hovered ?? false;
}

