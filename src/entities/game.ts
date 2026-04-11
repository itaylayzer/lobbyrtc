import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Lobby } from './lobby';

@Entity('game')
export class Game {
    @PrimaryGeneratedColumn('increment')
    id!: number;

    @Column("varchar", { length: 25, unique: true })
    name!: string;

    @Column('smallint', { default: 8 })
    maxPlayers!: number;

    @OneToMany(() => Lobby, (lobby: Lobby) => lobby.game)
    lobbies!: Lobby[];
}