import { mock } from "bun:test";

/** Deterministic test tokens (no `private.pem` / RSA needed). */
function encodeAccessPayload(token: string, game: number): string {
    return "t." + Buffer.from(JSON.stringify({ token, game }), "utf8").toString("base64url");
}

function decodeAccessPayload(accessToken: string): { token: string; game: number } {
    if (!accessToken.startsWith("t.")) {
        throw new Error("invalid test access token");
    }
    return JSON.parse(Buffer.from(accessToken.slice(2), "base64url").toString("utf8"));
}

export function registerJwtTestMock(): void {
    mock.module("@/utils/jwtUtils", () => ({
        generateAccessToken: encodeAccessPayload,
        extractAccessToken: decodeAccessPayload,
    }));
}

export { decodeAccessPayload };
