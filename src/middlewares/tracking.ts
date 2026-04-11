import { NextFunction, Request, Response } from "express";

export const trackingMiddleware = (key: keyof typeof global.requestStats) => (req: Request, res: Response, next: NextFunction) => {
    global.requestStats[key] += 1;

    next();
}
