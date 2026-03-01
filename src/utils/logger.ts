import { createLogger, format, transports } from 'winston';

class Logger {
    private logger;

    constructor() {
        this.logger = createLogger({
            level: 'info',
            format: format.combine(
                format.timestamp(),
                format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} ${level}: ${message}`;
                })
            ),
            transports: [
                new transports.Console(),
                new transports.File({ filename: 'combined.log' }),
            ],
        });
    }

    log(message: string) {
        this.logger.info(message);
    }

    error(message: string) {
        this.logger.error(message);
    }

    warn(message: string) {
        this.logger.warn(message);
    }

    // Add more methods as needed for debug, etc.
}

export default new Logger();