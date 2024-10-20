/**
@arg {any} cond
@arg {string} msg
@return {asserts cond is true}
*/
export function assert(cond, msg) {
    if (!cond) {
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
@template T
@arg {any} obj
@arg {{ new(...args: any[]): T }} type
@return {asserts obj is T}
*/
export function assert_instanceof(obj, type) {
    if (!(obj instanceof type)) {
        throw new Error(`Assertion failed: ${obj} is not of type ${type.name}`);
    }
}

/**
@template T
@arg {string} name
@arg {T|undefined|null} obj
@return {T}
*/
export function cast_defined(name, obj) {
    if (obj == undefined) {
        throw new Error(`Error: ${name} is undefined!`);
    }
    return obj;
}
