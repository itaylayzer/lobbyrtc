import { NextFunction, Request, Response } from "express";

export const trackingMiddleware = (req: Request, res: Response, next: NextFunction) => {
    global.requestStats.httpRequestsTotal += 1;

    next();
}
