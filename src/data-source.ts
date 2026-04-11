import { DataSource } from "typeorm";
import { Game } from "./entities/game";
import { Lobby } from "./entities/lobby";

export const dataSource = new DataSource({
    type: "sqlite",
    database: "./lobbies.sql",
    logging: "all",
    synchronize: true,
    entities: [Game, Lobby],
})