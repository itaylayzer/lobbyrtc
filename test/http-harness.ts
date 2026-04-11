import type { Express } from "express";
import type { Server } from "node:http";

export async function withHttpServer(
    app: Express,
    fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
    const server: Server = await new Promise((resolve) => {
        const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") {
        throw new Error("expected TCP listen address");
    }
    const baseUrl = `http://127.0.0.1:${addr.port}`;
    try {
        await fn(baseUrl);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });
    }
}
