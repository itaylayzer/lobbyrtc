import { dataSource } from "@/data-source";
import { Lobby } from "@/entities/lobby";

export async function generateToken(game: number, length: number = 6, chars: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'): Promise<string> {
    const lobbies = await dataSource.getRepository(Lobby).find({
        where: {
            game: {
                id: game
            }
        },
        select: ['token']
    })

    let token = '';
    do {
        for (let i = 0; i < length; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (lobbies.some(lobby => lobby.token === token));

    return token;
}