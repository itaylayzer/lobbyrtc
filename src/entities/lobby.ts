import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { Game } from "./game";

@Entity('lobby')
export class Lobby {
    @PrimaryColumn("varchar", { length: 10 })
    token!: string;

    @PrimaryColumn()
    gameId!: number;

    @ManyToOne(() => Game, (game: Game) => game.lobbies)
    @JoinColumn({ name: "gameId", referencedColumnName: "id" })
    game!: InstanceType<typeof Game>;

    @Column("varchar", { length: 255 })
    webRTCId!: string;

    @Column('boolean', { default: true })
    visible!: boolean;

    @Column('smallint')
    playersCount!: number;

    @UpdateDateColumn()
    updateAt!: Date;
}