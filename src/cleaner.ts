import { LessThan } from "typeorm";
import { dataSource } from "./data-source";
import { Lobby } from "./entities/lobby";

export class Cleaner {
    private nextDate: Date;
    private previousDate: Date;
    private lastDeletedCount: number;

    private interval: NodeJS.Timeout;

    constructor() {
        this.previousDate = new Date(Date.now() + 15 * 60 * 1000);
        this.nextDate = this.previousDate
        this.lastDeletedCount = 0;
        const self = this;

        this.interval = setInterval(async () => {
            self.previousDate = new Date();
            self.nextDate = new Date(Date.now() + 15 * 60 * 1000);

            if (dataSource.isInitialized) {
                const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

                try {
                    self.lastDeletedCount = -1;
                    const deleteList = await dataSource.getRepository(Lobby).find({
                        where: {
                            updatedAt: LessThan(thirtyMinutesAgo)
                        },
                        relations: {
                            game: true
                        }
                    });

                    self.lastDeletedCount = -2;
                    await dataSource.getRepository(Lobby).remove(deleteList);

                    self.lastDeletedCount = deleteList.length;

                    deleteList.forEach((lobby) => {
                        cleanerlogger.info('deleted lobby for game: ', lobby.game.name, ' lobby:', lobby);
                    })
                } catch (err) {
                    cleanerlogger.error('cleaner error:', err);

                }
            }
        }, 1_000 * 60 * 15)

        global.readiness.cleaner = true;
        cleanerlogger.info('cleaner is ready');
    }

    getPreviousDate() {
        return this.previousDate;
    }

    getNextDate() {
        return this.nextDate;
    }

    getLastDeletedCount() {
        return this.lastDeletedCount;
    }

    emptyLobbies(lobbies: Lobby[]) {
        cleanerlogger.info(`check emptying ${lobbies.length} lobbies`);
        const canidatesToDistroy = lobbies.filter((l) => l.playersCount === 0 && l.createdAt.getTime() < Date.now() - 15 * 1000);
        cleanerlogger.info(`found ${canidatesToDistroy.length} empty lobbies to destroy for game`);

        if (dataSource.isInitialized) {
            dataSource.getRepository(Lobby).remove(canidatesToDistroy).then(() => {
                canidatesToDistroy.forEach((lobby) => {
                    cleanerlogger.info('destroyed empty lobby for game: ', lobby.game.name, ' lobby:', lobby);
                })
            }).catch((err) => {
                cleanerlogger.error('error while destroying empty lobbies:', err);
            })
        }
    }
}