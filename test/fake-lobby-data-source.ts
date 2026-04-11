/**
 * Minimal in-memory stand-in for TypeORM calls used by `generateToken` and `lobbies` routes.
 * Keeps tests working without touching `src` when the real entity/driver mapping is broken.
 */

export type LobbyRow = {
    token: string;
    gameId: number;
    webRTCId: string;
    visible: boolean;
    playersCount: number;
};

function matchesWhere(row: LobbyRow, where: Record<string, unknown>): boolean {
    if (where.token !== undefined && row.token !== where.token) return false;
    const game = where.game as { id?: number } | undefined;
    if (game?.id !== undefined && row.gameId !== game.id) return false;
    if (where.visible !== undefined && row.visible !== where.visible) return false;
    return true;
}

function toLobbyEntity(row: LobbyRow) {
    return {
        token: row.token,
        game: { id: row.gameId },
        webRTCId: row.webRTCId,
        visible: row.visible,
        playersCount: row.playersCount,
    };
}

export function createFakeLobbyDataSource() {
    const rows: LobbyRow[] = [];

    const repo = {
        async find(opts?: { where?: Record<string, unknown>; select?: string[] }) {
            const where = opts?.where ?? {};
            const list = rows.filter((r) => matchesWhere(r, where));
            const sel = opts?.select;
            if (sel?.length) {
                return list.map((r) => {
                    const o: Record<string, unknown> = {};
                    for (const k of sel) {
                        if (k === "token") o.token = r.token;
                        else if (k === "playersCount") o.playersCount = r.playersCount;
                        else if (k === "webRTCId") o.webRTCId = r.webRTCId;
                    }
                    return o;
                });
            }
            return list.map(toLobbyEntity);
        },

        async findOne(opts: { where: Record<string, unknown> }) {
            const row = rows.find((r) => matchesWhere(r, opts.where));
            return row ? toLobbyEntity(row) : null;
        },

        async save(lobby: {
            token: string;
            game: { id: number };
            webRTCId: string;
            visible: boolean;
            playersCount: number;
        }) {
            const gameId = lobby.game?.id;
            const ix = rows.findIndex((r) => r.token === lobby.token && r.gameId === gameId);
            const plain: LobbyRow = {
                token: lobby.token,
                gameId,
                webRTCId: lobby.webRTCId,
                visible: lobby.visible,
                playersCount: lobby.playersCount,
            };
            if (ix >= 0) rows[ix] = plain;
            else rows.push(plain);
            return lobby;
        },

        delete(criteria: { token: string; game: { id: number } }) {
            const gid = criteria.game.id;
            const ix = rows.findIndex((r) => r.token === criteria.token && r.gameId === gid);
            if (ix >= 0) rows.splice(ix, 1);
        },
    };

    return {
        dataSource: {
            getRepository() {
                return repo;
            },
        },
        clear() {
            rows.length = 0;
        },
    };
}
