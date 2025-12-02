import winston from 'winston';
import { config } from '../config/env';

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    config.nodeEnv === 'production'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                let msg = `${timestamp} [${level}]: ${message}`;
                if (Object.keys(meta).length > 0) {
                    msg += ` ${JSON.stringify(meta, null, 2)}`;
                }
                return msg;
            })
        )
);

export const logger = winston.createLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
        new winston.transports.Console(),
    ],
});

// Helper functions for structured logging
export const logEvent = {
    incomingMessage: (chatId: string, messageId: string, hasMedia: boolean) => {
        logger.info('Incoming message', {
            event: 'incoming_message',
            chatId,
            messageId,
            hasMedia,
        });
    },

    aiRequestSent: (chatId: string, messageId: string, requestId?: string) => {
        logger.info('AI request sent', {
            event: 'ai_request_sent',
            chatId,
            messageId,
            requestId,
        });
    },

    aiResponseReceived: (chatId: string, messageId: string, responseLength: number) => {
        logger.info('AI response received', {
            event: 'ai_response_received',
            chatId,
            messageId,
            responseLength,
        });
    },

    whatsappSent: (chatId: string, messageId: string) => {
        logger.info('WhatsApp message sent', {
            event: 'whatsapp_sent',
            chatId,
            messageId,
        });
    },

    error: (message: string, error: Error, context?: Record<string, any>) => {
        logger.error(message, {
            event: 'error',
            error: error.message,
            stack: error.stack,
            ...context,
        });
    },
};
