import { NextFunction, Request, Response } from "express";

export const errorMiddleware = (error: any, req: Request, res: Response, next: NextFunction) => {

    // 1. Log the incoming request
    logger.error(`error: ${req.originalUrl}`);
    logger.error(error);

    next();
}
