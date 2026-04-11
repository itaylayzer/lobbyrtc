import { ExpressPeerServer } from "peer";
import type { Server } from "node:http";

/** PeerJS signaling mounted under `/peer` on the same HTTP server (see server.ts). */
export function createPeerApp(httpServer: Server) {
    const peerApp = ExpressPeerServer(httpServer, {
        path: "/",
        key: "peerjs",
    });

    peerApp.on("connection", (client) => {
        peerlogger.info(`peer connected: ${client.getId()}`);
    });

    peerApp.on("disconnect", (client) => {
        peerlogger.info(`peer disconnected: ${client.getId()}`);
    });

    peerApp.on("error", (err) => {
        peerlogger.error(`peerserver error: ${err.message}`);
    });

    return peerApp;
}
