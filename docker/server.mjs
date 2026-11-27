import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname } from "node:path";
import { parse as parseQuery } from "node:querystring";

const root = new URL("../", import.meta.url);
const { redirects, rewrites } = JSON.parse(await readFile(new URL("routes.json", import.meta.url), "utf8"));
const api = new URL("api/", root);
const handlers = new Map();

for (const entry of await readdir(api, { recursive: true })) {
    if (!entry.endsWith(".js")) continue;
    const file = entry.replaceAll("\\", "/");
    const route = `/api/${file.slice(0, -3)}`;
    const { default: handler } = await import(new URL(file, api));
    if (typeof handler !== "function") continue;
    handlers.set(route, handler);
    if (route.endsWith("/index")) handlers.set(route.slice(0, -6), handler);
}

const contentTypes = new Map([
    [".html", "text/html; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".png", "image/png"]
]);

function rewrite(pathname) {
    for (const { source, destination } of rewrites) {
        if (source === pathname) return destination;
        if (!source.endsWith("/:path*")) continue;
        const prefix = source.slice(0, -6);
        if (pathname.startsWith(prefix)) {
            return destination.replace(":path*", pathname.slice(prefix.length));
        }
    }
    return pathname;
}

async function readJson(request) {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        bytes += chunk.length;
        if (bytes > 1024 * 1024) {
            throw Object.assign(new Error("Cuerpo demasiado grande"), { statusCode: 413 });
        }
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
        throw Object.assign(new Error("JSON inválido"), { statusCode: 400 });
    }
}

createServer(async (request, response) => {
    response.status = (code) => {
        response.statusCode = code;
        return response;
    };
    response.send = (body) => {
        if (!response.hasHeader("Content-Type")) {
            response.setHeader("Content-Type", typeof body === "string"
                ? "text/html; charset=utf-8"
                : "application/octet-stream");
        }
        return response.end(body);
    };
    response.json = (body) => {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        return response.end(JSON.stringify(body));
    };

    try {
        const { pathname, search } = new URL(request.url, "http://localhost");
        const redirect = redirects.find(({ source }) => source === pathname);
        if (redirect) {
            response.writeHead(redirect.permanent ? 308 : 307, { Location: redirect.destination + search });
            return response.end();
        }

        const destination = rewrite(pathname);
        const handler = handlers.get(destination);
        if (handler) {
            request.query = parseQuery(search.slice(1));
            const contentType = request.headers["content-type"]?.split(";")[0].trim().toLowerCase();
            if (request.method !== "GET" && request.method !== "HEAD" && contentType === "application/json"
                && request.headers["content-length"] !== "0") {
                request.body = await readJson(request);
            }
            await handler(request, response);
            return;
        }

        if (request.method !== "GET" && request.method !== "HEAD") {
            response.setHeader("Allow", "GET, HEAD");
            return response.status(405).end();
        }

        const file = destination.match(/^\/(src\/frontend\/(?:pages|styles|services|assets)\/(?:[\w-]+\/)*[\w.-]+)$/)?.[1];
        const contentType = file && contentTypes.get(extname(file));
        if (!contentType) {
            return response.status(404).end();
        }

        const body = await readFile(new URL(file, root));
        response.setHeader("Content-Type", contentType);
        response.setHeader("Content-Length", body.length);
        return response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
        if (response.headersSent) {
            response.destroy();
            return;
        }
        if (error.code === "ENOENT") {
            return response.status(404).end();
        }
        if (error.statusCode === 413) {
            response.setHeader("Connection", "close");
        }
        const status = error.statusCode ?? 500;
        return response.status(status).json({
            success: false,
            message: status === 500 ? "Error interno del servidor" : error.message
        });
    }
}).listen(3000, "0.0.0.0", () => {
    console.log("Servidor listo en el puerto 3000");
});
