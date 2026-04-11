import { beforeEach, describe, expect, test } from "bun:test";
import express from "express";
import "../src/defaults";
import { sysRouter } from "../src/routes/sys";
import { withHttpServer } from "./http-harness";

function sysApp() {
    const app = express();
    app.use("/sys", sysRouter);
    return app;
}

const allFalse = (): typeof global.readiness => ({
    dataSource: false,
    web: false,
    peer: false,
    games: false,
    cleaner: false,
});

describe("sys health endpoints", () => {
    beforeEach(() => {
        global.readiness = allFalse();
    });

    test("GET /sys/healthz returns 200 and ok", async () => {
        await withHttpServer(sysApp(), async (base) => {
            const res = await fetch(`${base}/sys/healthz`);
            expect(res.status).toBe(200);
            expect(await res.text()).toBe("ok");
        });
    });

    test("GET /sys/readyz returns 500 when not fully ready", async () => {
        await withHttpServer(sysApp(), async (base) => {
            const res = await fetch(`${base}/sys/readyz`);
            expect(res.status).toBe(500);
            const body = (await res.json()) as typeof global.readiness;
            expect(body).toEqual(allFalse());
        });
    });

    test("GET /sys/readyz returns 200 when all readiness flags are true", async () => {
        global.readiness = {
            dataSource: true,
            web: true,
            peer: true,
            games: true,
            cleaner: true,
        };
        await withHttpServer(sysApp(), async (base) => {
            const res = await fetch(`${base}/sys/readyz`);
            expect(res.status).toBe(200);
            const body = (await res.json()) as typeof global.readiness;
            expect(body).toEqual({
                dataSource: true,
                web: true,
                peer: true,
                games: true,
                cleaner: true,
            });
        });
    });
});
