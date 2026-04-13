/**
 * Minimal in-memory stand-in for TypeORM calls used by `generateToken` and `lobbies` routes.
 */

/** Matches `Game.maxPlayers` default in `src/entities/game.ts`. */
const DEFAULT_GAME_MAX_PLAYERS = 8;

export type LobbyRow = {
    token: string;
    gameId: number;
    webRTCId: string;
    visible: boolean;
    playersCount: number;
    password?: string;
    accessToken?: string;
};

function hasPassword(row: LobbyRow): boolean {
    return row.password != null && row.password.length > 0;
}

function matchesWhere(row: LobbyRow, where: Record<string, unknown>): boolean {
    if (where.token !== undefined && row.token !== where.token) return false;
    if (where.gameId !== undefined && row.gameId !== where.gameId) return false;
    const game = where.game as { id?: number } | undefined;
    if (game?.id !== undefined && row.gameId !== game.id) return false;
    if (where.visible !== undefined && row.visible !== where.visible) return false;

    // Mirrors quick-play: `where: { ..., password: undefined }` → only lobbies without a password
    if (Object.prototype.hasOwnProperty.call(where, "password")) {
        const pw = where.password;
        if (pw === undefined || pw === null) {
            if (hasPassword(row)) return false;
        } else if (row.password !== pw) {
            return false;
        }
    }

    return true;
}

function toLobbyEntity(row: LobbyRow) {
    return {
        token: row.token,
        gameId: row.gameId,
        game: { id: row.gameId, maxPlayers: DEFAULT_GAME_MAX_PLAYERS },
        webRTCId: row.webRTCId,
        visible: row.visible,
        playersCount: row.playersCount,
        password: row.password,
        accessToken: row.accessToken,
    };
}

export function createFakeLobbyDataSource() {
    const rows: LobbyRow[] = [];

    const repo = {
        async find(opts?: {
            where?: Record<string, unknown>;
            select?: string[];
            relations?: { game?: boolean };
        }) {
            const where = opts?.where ?? {};
            const list = rows.filter((r) => matchesWhere(r, where));
            const sel = opts?.select;
            if (sel?.length) {
                const withGame = opts?.relations?.game === true;
                return list.map((r) => {
                    const o: Record<string, unknown> = {};
                    for (const k of sel) {
                        if (k === "token") o.token = r.token;
                        else if (k === "playersCount") o.playersCount = r.playersCount;
                        else if (k === "webRTCId") o.webRTCId = r.webRTCId;
                        else if (k === "password") o.password = r.password ?? null;
                    }
                    if (withGame) {
                        o.game = { id: r.gameId, maxPlayers: DEFAULT_GAME_MAX_PLAYERS };
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
            webRTCId?: string;
            visible?: boolean;
            playersCount?: number;
            password?: string;
            accessToken?: string;
        }) {
            const gameId = lobby.game?.id;
            const ix = rows.findIndex((r) => r.token === lobby.token && r.gameId === gameId);
            const prev = ix >= 0 ? rows[ix] : undefined;

            const plain: LobbyRow = {
                token: lobby.token,
                gameId,
                webRTCId: lobby.webRTCId ?? prev?.webRTCId ?? "",
                visible: lobby.visible ?? prev?.visible ?? true,
                playersCount: lobby.playersCount ?? prev?.playersCount ?? 1,
                password: Object.prototype.hasOwnProperty.call(lobby, "password")
                    ? lobby.password
                    : prev?.password,
                accessToken: Object.prototype.hasOwnProperty.call(lobby, "accessToken")
                    ? lobby.accessToken
                    : prev?.accessToken,
            };

            if (ix >= 0) rows[ix] = plain;
            else rows.push(plain);
            return lobby;
        },

        delete(criteria: unknown) {
            const c = criteria as {
                token?: string;
                game?: { id?: number };
                gameId?: number;
            };
            const token = c.token;
            const gid = c.game?.id ?? c.gameId;
            if (token === undefined || gid === undefined) return;
            const ix = rows.findIndex((r) => r.token === token && r.gameId === gid);
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
