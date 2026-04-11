import { createLogger, format, transports } from 'winston';
const { combine, timestamp, label, printf, colorize } = format;

const customFormat = printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level}: ${message}`;
});

export const webLogger = createLogger({
    format: combine(
        label({ label: 'web' }),
        timestamp(),
        colorize(), // Colors are applied before the final template
        customFormat
    ),
    transports: [new transports.Console()]
});

export const peerlogger = createLogger({
    format: combine(
        label({ label: 'peer' }),
        timestamp(),
        colorize(), // Colors are applied before the final template
        customFormat
    ),
    transports: [new transports.Console()]
});

export const gamelogger = createLogger({
    format: combine(
        label({ label: 'game' }),
        timestamp(),
        colorize(), // Colors are applied before the final template
        customFormat
    ),
    transports: [new transports.Console()]
});

export const cleanerlogger = createLogger({
    format: combine(
        label({ label: 'cleaner' }),
        timestamp(),
        colorize(), // Colors are applied before the final template
        customFormat
    ),
    transports: [new transports.Console()]
});
