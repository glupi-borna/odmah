const fs = require("node:fs");
const zlib = require("node:zlib");
const { join, extname } = require("node:path");
const http = require("node:http");
const { execSync } = require("node:child_process");
const crypto = require("crypto");

function live_reload_script() {
    return `
        <script>
        function on_load(cb) {
            if (document.readyState === "complete") {
                cb();
            } else {
                window.addEventListener("load", cb);
            }
        }

        on_load(() => {
            const ws = new WebSocket("http://localhost:${args.port}");
            console.log("Established ws connection.");
            ws.onmessage = () => {
                ws.close();
                window.location.reload();
            };

            window.addEventListener("beforeunload", () => ws.close());
        });

        </script>
    `;
}

/**
@arg {any} obj
@return {any}
*/
function as_any(obj) {
    return obj;
}

/**
@template T
@arg {any} key
@arg {T} _obj
@return {keyof T}
*/
function as_keyof(key, _obj) {
    return key;
}

/**
@template T
@arg {string} arg
@arg {T} default_value
@returns {[value: T, advance: number]|Error}
*/
function cast_arg(arg, default_value) {
    switch (typeof default_value) {
        case "string": return [as_any(arg), 1];
        case "number": return [as_any(parseFloat(arg)), 1];
        case "boolean": {
            arg = arg.toLowerCase();
            if (arg=="on" || arg=="true" || arg=="yes") return [as_any(true), 1];
            if (arg=="off" || arg=="false" || arg=="no") return [as_any(false), 1];
            return [as_any(!default_value), 0];
        }
    }
    return new Error(
        `Unexpected argument default: ${arg}=${default_value} (${typeof default_value})`
    );
}

/** @arg {any} args_obj */
function args_help(args_obj) {
    let text = "odmah dev server";
    for (let key in args_obj) {
        if (!key.startsWith("?")) continue;
        let prop_name = key.slice(1);
        let short = prop_name.slice(0, 1);
        let desc = args_obj[key];
        text += `\n\t-${short}, --${prop_name}\n\t\t${desc}`;
    }
    return text;
}

const extension_mimetypes = {
    ".html": "text/html",
    ".json": "application/json",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
};

/**
@arg {...string} path
@returns {[contents: string, mime: string]}
*/
function get_file_and_mime(...path) {
    let full_path = join(...path);
    if (full_path.startsWith("/")) full_path = "." + full_path;
    let contents = fs.readFileSync(full_path, "utf8");

    let ext = extname(full_path);
    let mime = "text/plain";
    if (ext in extension_mimetypes) {
        mime = extension_mimetypes[as_keyof(ext, extension_mimetypes)];
    } else {
        mime = execSync(`file -b --mime-type "${full_path}"`, {encoding: "utf8"}).trim();
    }
    return [contents, mime];
}

/**
@template T
@arg {...() => T} fns
@returns T|undefined
*/
function try_all(...fns) {
    for (let fn of fns) {
        try {
            let val = fn();
            return val;
        } catch {}
    }
    return undefined;
}

function get_args() {
    let args = {
        port: 8000,
        dir: ".",
        "?dir": "The directory from which the server will serve files",
        "?port": "The port on which to serve the dev server",
        "?help": "Show this help text and exit"
    };
    let default_args = {...args};

    let found_errors = false;

    for (let i=2; i<process.argv.length; i++) {
        let arg = process.argv[i];
        let next = process.argv[i+1];

        if (arg == "--help" || arg == "-h") {
            console.log(args_help(default_args));
            process.exit(0);
        }

        let prop_name = as_keyof("", args);

        if (arg.startsWith("--")) {
            prop_name = as_keyof(arg.slice(2), args);

        } else if (arg.startsWith("-")) {
            let letter = arg.slice(1);
            for (let prop in args) {
                if (prop.startsWith(letter) && !prop.startsWith("?")) {
                    prop_name = as_keyof(prop, args);
                    break;
                }
            }

            if (as_any(prop_name) == "") {
                console.error(`Unknown command-line argument: ${arg}`);
                found_errors = true;
                continue;
            }
        }

        if (prop_name in args && !prop_name.startsWith("?")) {
            let arg_val = cast_arg(next, args[prop_name]);

            if (arg_val instanceof Error) {
                console.error(arg_val.message);
                found_errors = true;
            } else {
                as_any(args)[prop_name] = arg_val[0];
                i += arg_val[1];
            }

        } else {
            found_errors = true;
            console.error(`Unknown command-line argument: ${arg}`);
        }
    }

    if (found_errors) process.exit(1);
    return args;
}

let args = get_args();
process.chdir(args.dir);

const server = http.createServer((req, res) => {
    let file = try_all(
        () => get_file_and_mime(""+req.url),
        () => get_file_and_mime(""+req.url, "index.html")
    );

    if (file == undefined) {
        res.writeHead(404).end("Not found");
        console.log(404, req.method, req.url);
    } else {
        if (file[1] == "text/html") file[0] += live_reload_script();
        res.writeHead(200, {
            "Content-Type": file[1],
            "Content-Encoding": "gzip"
        });
        let result = zlib.gzipSync(file[0]);
        res.end(result);
    }

    res.end();
});

const WS_MAGIC_STRING = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
/** @type {import("node:stream").Duplex[]} */
const ws_clients = [];

server.on("upgrade", (req, socket, head) => {
    let hash = crypto.createHash("sha1");
    hash.update(req.headers["sec-websocket-key"] + WS_MAGIC_STRING);
    let accept_key = hash.digest("base64");

    socket.write(
        'HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
        'Upgrade: WebSocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept_key}\r\n` +
        '\r\n'
    );
    socket.allowHalfOpen = false;

    function finish() {
        let idx = ws_clients.indexOf(socket);
        if (idx == -1) return;
        ws_clients.splice(idx, 1);
        socket.end();
    }

    ws_clients.push(socket)
    socket.on("close", finish);
    socket.on("end", finish);
    socket.on("error", console.error);
    socket.on("data", d => {
        if (d instanceof Buffer) {
            // Handle the "close" message (0x8 is long close, 0x88 is short).
            let first_byte = d.at(0);
            if (first_byte == 0x8 || first_byte == 0x88) finish();
        }
    })
});

fs.watch(".", {recursive: true}, () => {
    for (let client of ws_clients) {
        if (client.writable) {
            const msg = Buffer.allocUnsafe(3);
            msg.set([0x81, 1, "r".charCodeAt(0)], 0);
            client.write(msg);
        }
    }
});

server.on("listening", () => {
    console.log(`Listening on http://localhost:${args.port}`);
});

server.on("clientError", (err, socket) => {
    if (as_any(err).code == "ECONNRESET" || !socket.writable) return;
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(args.port);
