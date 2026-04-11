import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { createFakeLobbyDataSource } from "./fake-lobby-data-source";
import { decodeAccessPayload, registerJwtTestMock } from "./jwt-test-mock";

global.requestStats = { httpRequestsTotal: 0, lobbiesRequestsTotal: 0 };

registerJwtTestMock();

const fake = createFakeLobbyDataSource();

mock.module("@/data-source", () => ({
    dataSource: fake.dataSource,
}));

const { lobbiesRouter } = await import("@/routes/lobbies");

const OK = "\u2713";
const ERR = "\u2717";

function check(label: string, condition: boolean, detail?: string): void {
    const tail = detail ? ` — ${detail}` : "";
    console.log(`  ${condition ? OK : ERR} ${label}${tail}`);
    expect(condition, label).toBe(true);
}

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use("/lobbies", lobbiesRouter);
    return app;
}

const flow = {
    base: "",
    server: null as ReturnType<typeof createServer> | null,
    gameId: 1,
    tokenA: "",
    tokenB: "",
    tokenB2: "",
    tokenPwd: "",
    accessA: "",
    accessB: "",
    accessB2: "",
    accessPwd: "",
};

function lobbyPath(suffix: string): string {
    return `${flow.base}/lobbies/${flow.gameId}${suffix}`;
}

function lobbiesRoot(): string {
    return `${flow.base}/lobbies`;
}

async function postLobby(body: {
    webRTCId: string;
    visible?: boolean;
    playersCount?: number;
    password?: string;
}): Promise<{ res: Response; token: string | null; accessToken: string | null }> {
    const res = await fetch(lobbyPath(""), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (res.status !== 201) {
        return { res, token: null, accessToken: null };
    }
    const json = (await res.json()) as { token?: string; accessToken?: string };
    return { res, token: json.token ?? null, accessToken: json.accessToken ?? null };
}

function putPlayers(accessToken: string, playersCount: number): Promise<Response> {
    return fetch(`${lobbiesRoot()}/players`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, playersCount }),
    });
}

function deleteLobby(accessToken: string): Promise<Response> {
    return fetch(`${lobbiesRoot()}/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
    });
}

describe.serial("Lobby API — two-session flow (in-memory fake DB)", () => {
    beforeAll(async () => {
        fake.clear();
        console.log("\n========== Lobby API: two sessions (A = public, B = hidden) ==========\n");

        const app = makeApp();
        const server = createServer(app);
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
        const addr = server.address() as AddressInfo;
        flow.base = `http://127.0.0.1:${addr.port}`;
        flow.server = server;
    });

    afterAll(async () => {
        if (flow.server) {
            await new Promise<void>((resolve, reject) => {
                flow.server!.close((err) => (err ? reject(err) : resolve()));
            });
            flow.server = null;
        }
        console.log(`\n  ${OK} Full flow completed\n`);
    });

    test("01 Session A: create visible lobby (5 players)", async () => {
        console.log("— 01 Session A: create visible lobby (5 players) —");
        const a1 = await postLobby({ webRTCId: "rtc-host-a", visible: true, playersCount: 5 });
        check("POST create A", a1.res.status === 201 && Boolean(a1.token) && Boolean(a1.accessToken), `token=${a1.token}`);
        flow.tokenA = a1.token!;
        flow.accessA = a1.accessToken!;
        const claims = decodeAccessPayload(flow.accessA);
        check("accessToken embeds lobby token + game", claims.token === flow.tokenA && claims.game === flow.gameId);
    });

    test("01b Visible lobby with password (lower playersCount — must not win quick-play)", async () => {
        console.log("\n— 01b Password-protected visible lobby (client hash stored verbatim) —");
        const HASH = "sha256:fake-client-hash-for-tests";
        const p1 = await postLobby({
            webRTCId: "rtc-host-pwd",
            visible: true,
            playersCount: 1,
            password: HASH,
        });
        check(
            "POST create password lobby",
            p1.res.status === 201 && Boolean(p1.token) && Boolean(p1.accessToken),
            `token=${p1.token}`,
        );
        flow.tokenPwd = p1.token!;
        flow.accessPwd = p1.accessToken!;
    });

    test("02 Session B: create hidden lobby", async () => {
        console.log("\n— 02 Session B: create hidden lobby —");
        const b1 = await postLobby({
            webRTCId: "rtc-host-b",
            visible: false,
            playersCount: 1,
        });
        check("POST create B (hidden)", b1.res.status === 201 && Boolean(b1.token) && Boolean(b1.accessToken));
        flow.tokenB = b1.token!;
        flow.accessB = b1.accessToken!;
    });

    test("03 GET visibles: public lobbies + password field; never hidden B", async () => {
        console.log("\n— 03 Visibles: public only; password echoed for client UX —");
        const vis1 = await fetch(lobbyPath("/visibles"));
        check("GET visibles status", vis1.status === 200);
        const list1 = (await vis1.json()) as Array<{
            token: string;
            webRTCId: string;
            playersCount: number;
            password?: string | null;
        }>;
        check("visibles length is 2 (A + password lobby)", list1.length === 2);
        check("visibles contains A", list1.some((l) => l.token === flow.tokenA));
        check("visibles contains password lobby", list1.some((l) => l.token === flow.tokenPwd));
        check("visibles does NOT contain hidden B", !list1.some((l) => l.token === flow.tokenB));
        for (const row of list1) {
            check(`row ${row.token} has fields`, "webRTCId" in row && "playersCount" in row && "password" in row);
        }
        const rowA = list1.find((l) => l.token === flow.tokenA)!;
        const rowP = list1.find((l) => l.token === flow.tokenPwd)!;
        check("open lobby has no/falsy password in list", !rowA.password);
        check("password lobby exposes stored string", rowP.password === "sha256:fake-client-hash-for-tests");
    });

    test("04 GET lobby A by token", async () => {
        console.log("\n— 04 Fetch lobby A by token —");
        const getA = await fetch(lobbyPath(`/${flow.tokenA}`));
        check("GET A", getA.status === 200);
        const bodyA = (await getA.json()) as { webRTCId: string; playersCount: number; password?: string };
        check("A webRTCId", bodyA.webRTCId === "rtc-host-a");
        check("A playersCount", bodyA.playersCount === 5);
        check("A has no password in GET body", bodyA.password == null || bodyA.password === "");
    });

    test("05 GET hidden lobby B by token (direct link still works)", async () => {
        console.log("\n— 05 Fetch hidden B by token —");
        const getB = await fetch(lobbyPath(`/${flow.tokenB}`));
        check("GET hidden B by token still works", getB.status === 200);
        const bodyB = (await getB.json()) as { webRTCId: string; playersCount: number; password?: string };
        check("B webRTCId", bodyB.webRTCId === "rtc-host-b");
        check("B has no password", bodyB.password == null || bodyB.password === "");
    });

    test("05b GET password lobby by token returns stored secret", async () => {
        console.log("\n— 05b GET password lobby —");
        const res = await fetch(lobbyPath(`/${flow.tokenPwd}`));
        check("GET password lobby", res.status === 200);
        const body = (await res.json()) as { password?: string; webRTCId: string };
        check("password echoed as stored", body.password === "sha256:fake-client-hash-for-tests");
        check("webRTCId", body.webRTCId === "rtc-host-pwd");
    });

    test("06 PUT A playersCount → 2 (access token)", async () => {
        console.log("\n— 06 Session A: lower players count —");
        const put1 = await putPlayers(flow.accessA, 2);
        check("PUT players → 2", put1.status === 200);
    });

    test("07 GET A reflects updated playersCount", async () => {
        console.log("\n— 07 GET A after PUT —");
        const getA2 = await fetch(lobbyPath(`/${flow.tokenA}`));
        const bodyA2 = (await getA2.json()) as { playersCount: number };
        check("GET A sees updated playersCount", bodyA2.playersCount === 2);
    });

    for (let i = 0; i < 8; i++) {
        const n = i + 1;
        test(`08.${n} quick-play #${n}: only open visible A, never B or password lobby`, async () => {
            if (n === 1) console.log("\n— 08 Quick-play (8×): no hidden, no password lobbies —");
            const qp = await fetch(lobbyPath("/quick-play"));
            check(`quick-play #${n} status 200`, qp.status === 200);
            const qpBody = (await qp.json()) as { token: string; webRTCId: string; playersCount: number };
            check(
                `quick-play #${n} is A only`,
                qpBody.token === flow.tokenA &&
                    qpBody.token !== flow.tokenB &&
                    qpBody.token !== flow.tokenPwd,
            );
        });
    }

    test("09 Session B: second lobby, visible (higher players)", async () => {
        console.log("\n— 09 Session B: visible lobby B2 —");
        const b2 = await postLobby({ webRTCId: "rtc-host-b2", visible: true, playersCount: 6 });
        check("POST B2 visible", b2.res.status === 201 && Boolean(b2.token) && Boolean(b2.accessToken));
        flow.tokenB2 = b2.token!;
        flow.accessB2 = b2.accessToken!;
    });

    test("10 quick-play prefers lowest playersCount (A vs B2)", async () => {
        console.log("\n— 10 Quick-play: A(2) vs B2(6) → A —");
        const qpPick = await fetch(lobbyPath("/quick-play"));
        check("quick-play status 200", qpPick.status === 200);
        const pick = (await qpPick.json()) as { token: string; playersCount: number };
        check("picked A (lowest count)", pick.token === flow.tokenA && pick.playersCount === 2);
    });

    test("11 PUT A playersCount → 9 so B2 becomes best target", async () => {
        console.log("\n— 11 Raise A’s count —");
        const put2 = await putPlayers(flow.accessA, 9);
        check("PUT A players → 9", put2.status === 200);
    });

    test("12 quick-play now prefers B2", async () => {
        console.log("\n— 12 Quick-play: should pick B2 —");
        const qpPick = await fetch(lobbyPath("/quick-play"));
        check("quick-play status 200", qpPick.status === 200);
        const pick = (await qpPick.json()) as { token: string };
        check("picked B2", pick.token === flow.tokenB2);
    });

    test("13 GET visibles: A, B2, password lobby; hidden B absent", async () => {
        console.log("\n— 13 Visibles still omit hidden B —");
        const vis2 = await fetch(lobbyPath("/visibles"));
        const list2 = (await vis2.json()) as Array<{ token: string }>;
        const tokens2 = new Set(list2.map((l) => l.token));
        check("visibles has A, B2, password lobby", tokens2.has(flow.tokenA) && tokens2.has(flow.tokenB2) && tokens2.has(flow.tokenPwd));
        check("visibles still omits hidden B", !tokens2.has(flow.tokenB));
    });

    test("14 DELETE visible lobbies A, B2, and password lobby (access tokens)", async () => {
        console.log("\n— 14 Tear down visible lobbies —");
        const delA = await deleteLobby(flow.accessA);
        check("DELETE A", delA.status === 200);
        const delB2 = await deleteLobby(flow.accessB2);
        check("DELETE B2", delB2.status === 200);
        const delPwd = await deleteLobby(flow.accessPwd);
        check("DELETE password lobby", delPwd.status === 200);
    });

    test("15 GET visibles empty; only hidden B remains", async () => {
        console.log("\n— 15 Visibles empty —");
        const vis3 = await fetch(lobbyPath("/visibles"));
        const list3 = (await vis3.json()) as unknown[];
        check("visibles empty (only hidden B left)", list3.length === 0);
    });

    test("16 GET quick-play returns 404 when no visible lobbies", async () => {
        console.log("\n— 16 Quick-play 404 —");
        const qp404 = await fetch(lobbyPath("/quick-play"));
        check("quick-play 404 when no visible lobbies", qp404.status === 404);
    });

    test("17 GET hidden B still works; DELETE B cleans up", async () => {
        console.log("\n— 17 Hidden B still retrievable; cleanup —");
        const getBStill = await fetch(lobbyPath(`/${flow.tokenB}`));
        check("GET hidden B still 200", getBStill.status === 200);
        const delB = await deleteLobby(flow.accessB);
        check("DELETE B", delB.status === 200);
    });
});
