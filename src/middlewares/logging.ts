import { NextFunction, Request, Response } from "express";

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // 1. Log the incoming request
    logger.info(`request: ${req.method} ${req.originalUrl}`);

    // 2. Listen for the 'finish' event to log the response
    res.on('finish', () => {
        logger.info(`response: ${req.method} ${req.originalUrl} | ${res.statusCode}`);
    });

    next();
}
