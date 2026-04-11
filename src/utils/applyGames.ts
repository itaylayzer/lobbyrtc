import { dataSource } from "@/data-source";
import { Game } from "@/entities/game";
import { ConfigJson, GameJson } from "@/types/gamesJson";

async function applyGame(game: GameJson): Promise<{ gameName: string, state: "ok" | "changed" | "error", error?: any }> {

    const checkIfExist = async () => {
        const existedGame = await dataSource.getRepository(Game).findOne({
            where: {
                name: game.name
            }
        });

        return Boolean(existedGame);
    }
    try {

        if (await checkIfExist()) {
            return { gameName: game.name, state: "ok" };
        }



    } catch (err) {
        return { gameName: game.name, state: "error", error: { err, place: 'didnt fetch' } };
    }

    try {
        await dataSource.getRepository(Game).save({ name: game.name, maxPlayers: game.maxPlayers ?? undefined });

        if (await checkIfExist()) {
            return { gameName: game.name, state: "changed" };
        }
    } catch (err) {
        return { gameName: game.name, state: "error", error: { err, place: 'created' } };

    }

    return { gameName: game.name, state: "error", error: { err: new Error('not created'), place: 'after' } };

}

export async function applyGames() {
    const configJsonFile = await Bun.file('config/config.json').text();
    const games = JSON.parse(configJsonFile) as ConfigJson;

    if (!games || games.length === 0) {
        gamelogger.error('no games');
        throw new Error('no games');
    }

    const promises = games.map(applyGame);
    const results = await Promise.all(promises);

    for (const { gameName, state, error } of results) {
        gamelogger[state === 'error' ? 'error' : 'info'](`gameName='${gameName}' state='${state}'${error ? " " + JSON.stringify(error, null, 4) : ""}`);

        if (error) throw error;
    }
}