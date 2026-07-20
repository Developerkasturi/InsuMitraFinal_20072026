// ─────────────────────────────────────────────────────────────────────────────
// Winston logger configuration (used in main.ts bootstrap)
// ─────────────────────────────────────────────────────────────────────────────
import * as winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, context, stack }) => {
  const ctx = context ? `[${context}] ` : '';
  const err = stack ? `\n${stack}` : '';
  return `${ts} ${level}: ${ctx}${message}${err}`;
});

export const winstonConfig: winston.LoggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),    // capture stack traces
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()   // structured JSON in production
      : combine(colorize(), logFormat),
  ),
  transports: [
    new winston.transports.Console(),
    // File transports for production
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
  exceptionHandlers: [new winston.transports.Console()],
};
