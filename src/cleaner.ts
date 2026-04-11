import { LessThan } from "typeorm";
import { dataSource } from "./data-source";
import { Lobby } from "./entities/lobby";

export class Cleaner {
    private nextDate: Date;
    private previousDate: Date;
    private lastDeletedCount: number;

    private interval: NodeJS.Timeout;

    constructor() {
        this.previousDate = new Date();
        this.nextDate = this.previousDate;
        this.nextDate.setHours(this.nextDate.getHours() + 1);
        this.lastDeletedCount = 0;
        const self = this;

        this.interval = setInterval(async () => {
            self.previousDate = new Date();
            self.nextDate = new Date();
            self.nextDate.setHours(self.previousDate.getHours() + 1);

            if (dataSource.isInitialized) {
                const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

                try {
                    self.lastDeletedCount = -1;
                    const deleteList = await dataSource.getRepository(Lobby).find({
                        where: {
                            updateAt: LessThan(thirtyMinutesAgo)
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
}