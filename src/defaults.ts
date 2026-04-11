import { Cleaner } from './cleaner';
import { webLogger, peerlogger, gamelogger, cleanerlogger } from './logger'
global.readiness = {
    dataSource: false,
    peer: false,
    web: false,
    games: false,
    cleaner: false,
};

global.requestStats = {
    httpRequestsTotal: 0,
    lobbiesRequestsTotal: 0,
};

global.logger = webLogger;
global.peerlogger = peerlogger;
global.gamelogger = gamelogger;
global.cleanerlogger = cleanerlogger;

global.cleaner = new Cleaner();