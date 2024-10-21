import { data } from "./data.js";

/**
@template RETURN
@arg {(...args: any[]) => RETURN} _fn
@returns {RETURN}
*/
function return_type(_fn) {
    // @ts-ignore
    return new Error("Do not use this value!");
}

/**
@template TYPE
@arg {TYPE} _type
@arg {any} val
@returns {TYPE[]}
*/
function array_of(_type, val=[]) {
    return val;
}

/**
@template TYPE
@arg {TYPE} val
@arg {TYPE} _type
@returns {TYPE}
*/
function cast(val, _type) {
    return val;
}

/**
@template T
@arg {T|undefined|null} val
@returns {T}
*/
function defined(val) {
    return /** @type {T} */(val);
}

/** @arg {number} ms */
export function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** @arg {number} a @arg {number} b */
export function int(a, b=0) {
    let min = Math.min(a, b);
    let max = Math.max(a, b);
    return Math.floor(Math.random()*(max-min))+min;
}

/** @template T @arg {T[]} array */
export function pick(array) {
    return array[int(array.length)];
}

/** @template T @arg {T[]} array */
export function some(array, perc=0.9) {
    array = [...array];
    let out = cast([], array);
    let idx = int(array.length);
    while (array[idx]) {
        if (Math.random() < perc) out.push(defined(array[idx]));
        array.splice(idx, 1);
        idx = int(array.length);
    }
    return out;
}

/** @template T @arg {T[]} array @arg {(t: T) => T} fn */
export function map_maybe(array, fn, perc=0.5) {
    return array.map(item => Math.random() < perc ? fn(item) : item);
}

export function first_name() {
    if (Math.random()<0.2)
        return `${pick(data.first_names)} ${pick(data.first_names)}`;
    return pick(data.first_names);
}

export function last_name() {
    if (Math.random()<0.2)
        return `${pick(data.last_names)} ${pick(data.last_names)}`;
    return pick(data.last_names);
}

export function email(parts=[first_name(), last_name()]) {
    let address = "";
    while (parts.length > 0) {
        let part_idx = int(parts.length);
        let part = defined(parts[part_idx]).replace(/\W/g, '').toLowerCase();
        let subparts = some(part.split(" "));
        subparts = map_maybe(subparts, p => p.charAt(0), 0.1);
        part = subparts.join(pick(["", ".", "_", "-"]));

        if (address.length == 0 || Math.random() > 0.1) {
            if (address.length > 0 && Math.random() > 0.5) address += pick(["", ".", "_", "-"]);
            address += part;
        }
        parts.splice(part_idx, 1);
    }
    return address + "@fakemail.com";
}

export function database() {
    let tables = array_of(return_type(table));

    /** @arg {string} name */
    function table(name) {
        let columns = array_of(return_type(column));
        /** @type {Record<string, any>[]} */
        let data = [];

        /**
        @arg {string} name
        @arg {(self: Record<string, any>) => any} generate
        */
        function column(name, generate) {
            let col = {name, generate};
            columns.push(col);
            return col;
        }

        function generate(count=1) {
            let old_len = data.length;
            for (let i=0; i<count; i++) {
                /** @type {Record<string, any>} */
                let row = {};
                for (let column of columns) {
                    row[column.name] = column.generate(row);
                }
                data.push(row);
            }
            return data.slice(old_len, old_len+count);
        }

        return {
            name,
            columns,
            data,
            column,
            generate
        };
    }

    return {
        tables,
        table
    };
}

/** @typedef {ReturnType<typeof database>} DB */
/** @typedef {DB["tables"][number]} Table */


/** @arg {DB} db */
export function api_endpoints(db) {
    /** @arg {Table} table @arg {Record<string, any>} data */
    async function create_row(table, data) {
        await wait(int(100, 250));
        table.data.push(data);
    }

    /** @arg {Table} table @arg {number} idx */
    async function read_row(table, idx) {
        await wait(int(50, 250));
        return table.data[idx];
    }

    /** @arg {Table} table @arg {number} page_no @arg {number} page_size */
    async function read_slice(table, page_no, page_size) {
        await wait(int(100, 500));
        let first = page_size*(page_no-1);
        return table.data.slice(first, first+page_size);
    }

    /** @arg {Table} table @arg {number} idx @arg {Record<string, any>} data */
    async function update_row(table, idx, data) {
        await wait(int(100, 250));
        table.data[idx] = data;
    }

    /** @arg {Table} table @arg {number} idx */
    async function delete_row(table, idx) {
        await wait(int(100, 250));
        table.data.splice(idx, 1);
    }

    /** @arg {Table} table */
    function crud_group(table) {
        return {
            get: read_row.bind(null, table),
            get_page: read_slice.bind(null, table),
            create: create_row.bind(null, table),
            update: update_row.bind(null, table),
            delete: delete_row.bind(null, table),
        }
    }

    /** @type {Record<string, ReturnType<typeof crud_group>>} */
    let api = {};
    for (let table of db.tables) {
        api[table.name] = crud_group(table);
    }
    return api;
}

/*/
function example() {
    let db = database();

    let users = db.table("users");
    users.column("first_name", first_name);
    users.column("last_name", last_name);
    users.column("email", (usr) => email([usr.first_name, usr.last_name]));
    users.column("created_by", () => {
        if (users.data.length == 0) return null;
        return pick(users.data);
    });

    let todos = db.table("todos");
    const connector = ["the", "my", "with the", "with"]
    todos.column("title", () => {
        switch (int(5)) {
            case 0: return `${pick(data.verbs)} ${pick(connector)} ${pick(data.nouns)}`;
            case 1: return `${pick(data.verbs)} ${pick(connector)} ${pick(data.nouns)} ${pick(data.nouns)}`;
            case 2: return `${pick(data.verbs)} ${pick(["with", "to"])} ${pick(users.data).first_name}`;
            case 3: return `${pick(data.verbs)} and ${pick(data.verbs)}`;
            case 4: return `${pick(data.verbs)} ${pick(users.data).first_name}`;
        }
    });
    todos.column("created_by", () => pick(users.data));
    todos.column("done", () => Math.random()>0.5);

    users.generate(10);
    todos.generate(20);

    let api = api_endpoints(db);
    console.log(api);
}
/**/
