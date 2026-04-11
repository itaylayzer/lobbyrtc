import { Router } from "express";

export const sysRouter = Router();

sysRouter.get('/healthz', (_req, res) => {
    res.status(200).send("ok");
});

sysRouter.get('/readyz', (_req, res) => {
    if (Object.values(global.readiness).includes(false)) {
        return res.status(500).json(global.readiness);
    };

    return res.status(200).json(global.readiness);
});