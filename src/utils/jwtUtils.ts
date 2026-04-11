import * as jwt from 'jsonwebtoken';

export function generateAccessToken(token: string, game: number): string {
    const payload = { token, game };

    return jwt.sign(payload, global.jwtKey, { algorithm: 'RS384', expiresIn: '2h' });
}

export function extractAccessToken(accessToken: string): { token: string, game: number } {
    const payload = jwt.verify(accessToken, global.jwtKey, { algorithms: ['RS384'] }) as { token: string, game: number };
    return payload;
}