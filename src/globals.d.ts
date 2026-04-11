import { Logger } from "winston";
import { Cleaner } from "./cleaner";

export { };

declare global {
    var readiness: {
        dataSource: boolean;
        web: boolean;
        peer: boolean;
        games: boolean;
        cleaner: boolean;
    }

    var requestStats: {
        httpRequestsTotal: number;
    };

    var logger: Logger;
    var peerlogger: Logger;
    var gamelogger: Logger;
    var cleanerlogger: Logger;

    var cleaner: Cleaner;
}