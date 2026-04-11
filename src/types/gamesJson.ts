export interface GameJson {
    name: string;
    maxPlayers?: number;
}

export type ConfigJson = Array<GameJson>;