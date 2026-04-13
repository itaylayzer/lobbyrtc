import { dataSource } from "@/data-source";
import { Lobby } from "@/entities/lobby";
import { trackingMiddleware } from "@/middlewares/tracking";
import { arrayShuffle } from "@/utils/arrayShuffle";
import { generateToken } from "@/utils/generateToken";
import { extractAccessToken, generateAccessToken } from "@/utils/jwtUtils";
import { Router } from "express";

export const lobbiesRouter = Router();
lobbiesRouter.use(trackingMiddleware('lobbiesRequestsTotal'));

lobbiesRouter.post('/:game', async (req, res, next) => {
    const { game } = req.params;
    const { webRTCId, visible, playersCount, password } = req.body;

    if (parseInt(game) <= 0 || isNaN(parseInt(game))) {
        return res.status(400).json({ error: 'Invalid game id' });
    }

    if (webRTCId === undefined || webRTCId === null || webRTCId.length === 0) {
        return res.status(400).json({ error: 'Missing webRTCId' });
    }

    const initialPlayers =
        typeof playersCount === 'number' && !Number.isNaN(playersCount)
            ? playersCount
            : 1;

    try {
        const token = await generateToken(parseInt(game));
        const accessToken = generateAccessToken(token, parseInt(game));

        await dataSource.getRepository(Lobby).save({
            token: token,
            game: { id: parseInt(game) },
            visible: visible !== false,
            webRTCId: webRTCId,
            playersCount: initialPlayers,
            password: typeof password === 'string' && password.length > 0 ? password : undefined,
            accessToken
        });


        return res.status(201).json({ token, accessToken });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', errorDetails: err });
        return next(err);
    }

});

lobbiesRouter.get('/:game/quick-play', async (req, res, next) => {
    const { game } = req.params;

    if (parseInt(game) <= 0 || isNaN(parseInt(game))) {
        return res.status(400).json({ error: 'Invalid game id' });
    }

    try {
        const list = (await dataSource.getRepository(Lobby).find({
            where: { game: { id: +game }, visible: true, password: undefined },
        }));
        const canidates = list.filter((l) => l.playersCount > 0);

        if (canidates.length === 0) {
            if (list.length > 0) {
                cleanerlogger.info(`quick play: no candidates with players count > 0, emptying ${list.length} lobbies for game ${game}`);
                cleaner.emptyLobbies(list);
            }
            return res.status(404).json({ error: 'No visible lobbies' });
        }

        const sorted = list.toSorted((a, b) => a.playersCount - b.playersCount);
        const min = sorted[0].playersCount;
        const pool = sorted.filter((l) => l.playersCount === min);
        const candidate = arrayShuffle([...pool])[0];

        return res.status(200).json({
            webRTCId: candidate.webRTCId,
            token: candidate.token,
            playersCount: candidate.playersCount,
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', errorDetails: err });
        return next(err);
    }

});

lobbiesRouter.get('/:game/visibles', async (req, res, next) => {
    const { game } = req.params;

    if (parseInt(game) <= 0 || isNaN(parseInt(game))) {
        return res.status(400).json({ error: 'Invalid game id' });
    }

    try {
        const list = await dataSource.getRepository(Lobby).find({ where: { game: { id: +game }, visible: true }, select: ['token', 'playersCount', 'password'] })
        const visibles = list.map((l) => ({ token: l.token, playersCount: l.playersCount, password: typeof l.password === 'string' && l.password.length > 0 ? "true" : undefined }));

        return res.status(200).json(visibles);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', errorDetails: err });
        return next(err);
    }

});


lobbiesRouter.delete('/', async (req, res, next) => {
    const { accessToken } = req.body;

    if (!accessToken || typeof accessToken !== 'string' || accessToken.length === 0) {
        return res.status(400).json({ error: 'Missing access token' });
    }
    try {
        const { game, token } = extractAccessToken(accessToken);

        const lobby = await dataSource.getRepository(Lobby).findOne({
            where: {
                token,
                game: {
                    id: game
                }
            },
        })

        if (lobby === null) {
            return res.status(404).json({ error: 'Lobby not found' });
        }

        dataSource.getRepository(Lobby).delete({
            token,
            game: {
                id: game
            }
        })

        logger.info(`lobby deleted: ${token} for game ${game}`);
        return res.status(200).send();
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', errorDetails: err });
        return next(err);
    }
});

lobbiesRouter.get('/:game/:token', async (req, res, next) => {
    const { game, token } = req.params;

    if (!game || !token) {
        return res.status(400).json({ error: 'Missing game or token' });
    }

    if (parseInt(game) <= 0 || isNaN(parseInt(game))) {
        return res.status(400).json({ error: 'Invalid game id' });
    }

    try {
        const lobby = await dataSource.getRepository(Lobby).findOne({
            where: {
                token,
                game: {
                    id: +game
                }
            },
            select: ['webRTCId', 'playersCount', 'password']
        })

        if (lobby === null) {
            return res.status(404).json({ error: 'Lobby not found' });
        }

        const doNeedPassword = typeof lobby.password === 'string' && lobby.password.trim().length > 0;
        if (doNeedPassword) {
            logger.info(`lobby ${token} for game ${game} requires password, checking authorization header`);

            if (typeof req.headers.authorization !== 'string' || req.headers.authorization.length === 0 || req.headers.authorization.startsWith('Basic ') === false) {
                return res.status(401).json({ error: 'Missing or invalid authorization header' });
            }

            const credentials = Buffer.from(req.headers.authorization.replace('Basic ', ''), 'base64').toString();
            const providedPassword = credentials.split(':')[1];
            if (providedPassword !== lobby.password) {
                return res.status(403).json({ error: 'Invalid password' });
            }
        }

        return res.status(200).json({ webRTCId: lobby.webRTCId, playersCount: lobby.playersCount });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', errorDetails: err });
        return next(err);
    }
});

lobbiesRouter.put('/players', async (req, res, next) => {
    const { playersCount, accessToken } = req.body;

    if (!accessToken || typeof accessToken !== 'string' || accessToken.length === 0) {
        return res.status(400).json({ error: 'Missing access token' });
    }

    if (typeof playersCount !== 'number' || isNaN(playersCount)) {
        return res.status(400).json({ error: `Invalid players count: ${playersCount}` });
    }

    try {
        const { game, token } = extractAccessToken(accessToken);

        const lobby = await dataSource.getRepository(Lobby).findOne({
            where: {
                token,
                game: {
                    id: game
                }
            },
        })

        if (lobby === null) {
            return res.status(404).json({ error: 'Lobby not found' });
        }

        if (playersCount === 0) {
            await dataSource.getRepository(Lobby).delete(lobby);
            logger.info(`lobby deleted: ${token} for game ${game}, cause players count is 0`);

            return res.status(200).send();
        }

        lobby.playersCount = playersCount;
        await dataSource.getRepository(Lobby).save(lobby);

        return res.status(200).send();
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', errorDetails: err });
        return next(err);
    }
});