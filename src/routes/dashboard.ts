import { dataSource } from "@/data-source";
import { Game } from "@/entities/game";
import path from "path";
import { Router } from "express";

export const dashboardRouter = Router();

const indexPath = path.join(process.cwd(), "public", "index.html");

dashboardRouter.get("/", (_req, res) => {
    res.sendFile(indexPath);
});

dashboardRouter.get("/api/overview", async (_req, res, next) => {
    try {
        const games = await dataSource.getRepository(Game).find({
            relations: { lobbies: true },
            order: { id: "ASC" },
        });

        res.json({
            server: {
                uptimeSec: process.uptime(),
                cpuUsage: process.cpuUsage(),
                memoryUsage: process.memoryUsage(),
                now: Date.now(),
                readiness: global.readiness,
            },
            usage: {
                httpRequestsTotal: global.requestStats.httpRequestsTotal,
                lobbiesRequestsTotal: global.requestStats.lobbiesRequestsTotal,
            },
            games: games.map((g) => ({
                id: g.id,
                name: g.name,
                maxPlayers: g.maxPlayers,
                lobbyCount: g.lobbies.length,
                visibleLobbyCount: g.lobbies.filter((l) => l.visible).length,
                playersInLobbies: g.lobbies.reduce((s, l) => s + l.playersCount, 0),
                lobbies: g.lobbies.map((l) => ({
                    token: l.token,
                    playersCount: l.playersCount,
                    visible: l.visible,
                    webRTCId: l.webRTCId,
                })),
            })),
            cleaner: {
                lastDeletedCount: cleaner.getLastDeletedCount(),
                previous: cleaner.getPreviousDate().toISOString(),
                next: cleaner.getNextDate().toISOString(),
            },
        });
    } catch (err) {
        next(err);
    }
});
