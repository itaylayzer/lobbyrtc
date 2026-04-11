import dotenv from "dotenv";
dotenv.config();

import "./defaults";
import { createPeerApp } from "./peer";
import { createServer } from "http";
import express from "express";
import { dataSource } from "./data-source";
import { sysRouter } from "./routes/sys";
import { lobbiesRouter } from "./routes/lobbies";
import { dashboardRouter } from "./routes/dashboard";
import { loggingMiddleware } from "./middlewares/logging";
import { errorMiddleware } from "./middlewares/error";
import { applyGames } from "./utils/applyGames";
import { trackingMiddleware } from "./middlewares/tracking";
import cors from 'cors';

const { env } = process;

const WEB_PORT = parseInt(env.WEB_PORT || "8080", 10);
const DASHBOARD_PORT = parseInt(env.DASHBOARD_PORT || "9000", 10);

const app = express();
const server = createServer(app);

const dashboardApp = express();
const dashboardServer = createServer(dashboardApp);

dataSource.initialize().then(() => {
    readiness.dataSource = true;
    logger.info("data source initialized");

    applyGames().then(() => {
        readiness.games = true;
    }).catch(err => {
        gamelogger.error("couldnot load games:", err);
        process.exit(1);
    });

    try {
        app.use(cors({ origin: '*' }))
        app.use(express.json());
        app.use(loggingMiddleware);
        app.use(trackingMiddleware);
        app.use("/sys", sysRouter);
        app.use("/peer", createPeerApp(server));
        app.use("/lobbies", lobbiesRouter);
        app.use(errorMiddleware);

        readiness.peer = true;

        server.listen(WEB_PORT, () => {
            readiness.web = true;
            logger.info(
                `http + peerjs server is listening on http://${env.HOSTNAME || env.HOST || "localhost"}:${WEB_PORT} (Peer signaling: /peer)`
            );
        });

        dashboardApp.use(express.json());
        dashboardApp.use(loggingMiddleware);
        dashboardApp.use("/", dashboardRouter);
        dashboardApp.use(errorMiddleware);

        dashboardServer.listen(DASHBOARD_PORT, () => {
            logger.info(
                `dashboard is listening on http://${env.HOSTNAME || env.HOST || "localhost"}:${DASHBOARD_PORT}/dashboard/`
            );
        });
    } catch (err) {
        logger.error(err);
        process.exit(1);
    }
});
