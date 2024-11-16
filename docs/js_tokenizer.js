export const keywords = /** @type {readonly string[]} */([
    "if", "for", "else", "let", "const", "function", "return", "async", "await"
]);

export const fwk_fns = /** @type {readonly string[]} */([
    "container", "step_out", "element", "get_element_state", "hook", "attr",
    "style", "css", "cls", "text"
]);

/** @arg {string} ch */
export function is_ws(ch) {
    return ch == " " || ch == "\t" || ch == "\n" || ch == "\r";
}

const CHAR_0 = "0".charCodeAt(0);
const CHAR_9 = "9".charCodeAt(0);
/** @arg {string} ch */
export function is_digit(ch) {
    let c = ch.charCodeAt(0);
    return c>=CHAR_0 && c<=CHAR_9;
}

const CHAR_a = "a".charCodeAt(0);
const CHAR_z = "z".charCodeAt(0);
const CHAR_A = "A".charCodeAt(0);
const CHAR_Z = "Z".charCodeAt(0);
const CHAR__ = "_".charCodeAt(0);
/** @arg {string} ch */
export function is_ident_char(ch) {
    let c = ch.charCodeAt(0);
    return (
        (c>=CHAR_a && c<=CHAR_z) ||
        (c>=CHAR_A && c<=CHAR_Z) ||
        (c>=CHAR_0 && c<=CHAR_9) ||
        (c == CHAR__)
    );
}

const CHAR_sq = "'".charCodeAt(0);
const CHAR_dq = '"'.charCodeAt(0);
const CHAR_bt = "`".charCodeAt(0);
/** @arg {string} ch */
export function is_quote(ch) {
    let c = ch.charCodeAt(0);
    return c == CHAR_sq || c == CHAR_dq || c == CHAR_bt;
}

/** @arg {string} code */
export function tokenize_js(code) {
    /** @type {string[]} */
    let tokens = [];

    for (let i=0; i<code.length; i++) {
        let ch = code.charAt(i);

        if (is_ws(ch)) {
            let start = i;
            while (is_ws(code.charAt(i))) i++;
            tokens.push(code.slice(start, i));
            i--;
            continue;
        }

        if (is_digit(ch)) {
            let start = i;
            while (is_digit(code.charAt(i))) i++;
            tokens.push(code.slice(start, i));
            i--;
            continue;
        }

        if (is_ident_char(ch)) {
            let start = i;
            while (is_ident_char(code.charAt(i))) i++;
            tokens.push(code.slice(start, i));
            i--;
            continue;
        }

        if (is_quote(ch)) {
            let start = i;
            while (i<code.length && code.charAt(++i) != ch) {
                if (code.charAt(i) == "\\") { i++; }
            }
            tokens.push(code.slice(start, i+1));
            continue;
        }

        if (ch == "/" && code.charAt(i+1) == "/") {
            let start = i;
            while (i<code.length && code.charAt(i+1) != "\n") {
                i++;
            }
            tokens.push(code.slice(start, i+1));
            continue;
        }

        if (ch == "/" && code.charAt(i+1) == "*") {
            let start = i;
            while (i<code.length && !(code.charAt(i) == "/" && code.charAt(i-1) == "*")) {
                i++;
            }
            tokens.push(code.slice(start, i+1));
            continue;
        }

        tokens.push(ch);
    }
    return tokens;
}
