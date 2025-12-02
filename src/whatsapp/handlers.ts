import { Message } from 'whatsapp-web.js';
import { WhatsAppClient } from './client';
import { QueueManager } from '../queue/manager';
import { config } from '../config/env';
import { logger, logEvent } from '../utils/logger';

export class MessageHandler {
    private whatsappClient: WhatsAppClient;
    private queueManager: QueueManager;

    constructor(whatsappClient: WhatsAppClient, queueManager: QueueManager) {
        this.whatsappClient = whatsappClient;
        this.queueManager = queueManager;
    }

    /**
     * Handle incoming WhatsApp message
     */
    async handleMessage(message: Message): Promise<void> {
        try {
            const chat = await message.getChat();
            const chatId = chat.id._serialized;
            const messageId = message.id._serialized;

            // Filter group messages if not allowed
            if (chat.isGroup && !config.whatsapp.allowGroupMessages) {
                logger.debug('Ignoring group message', { chatId, messageId });
                return;
            }

            // Get message content
            const messageText = message.body;
            if (!messageText || messageText.trim().length === 0) {
                logger.debug('Ignoring empty message', { chatId, messageId });
                return;
            }

            // Get contact info (with fallback for WhatsApp Web API changes)
            let userName: string | undefined;
            try {
                const contact = await message.getContact();
                userName = contact.pushname || contact.name || undefined;
            } catch (error) {
                // Fallback: WhatsApp Web API may have changed
                logger.debug('Could not fetch contact info, using fallback', {
                    chatId,
                    messageId,
                    error: (error as Error).message
                });
                // Try to get name from chat or use undefined
                userName = chat.name || undefined;
            }

            // Handle media if present
            let mediaAttachments: Array<{
                filename: string;
                mime: string;
                data_base64: string;
            }> | undefined;

            if (message.hasMedia) {
                try {
                    logger.debug('Downloading media', { chatId, messageId });
                    const media = await message.downloadMedia();

                    if (media) {
                        mediaAttachments = [{
                            filename: media.filename || 'media',
                            mime: media.mimetype,
                            data_base64: media.data,
                        }];

                        logger.debug('Media downloaded', {
                            chatId,
                            messageId,
                            filename: media.filename,
                            mime: media.mimetype,
                            sizeKB: Math.round(media.data.length / 1024),
                        });
                    }
                } catch (error) {
                    logger.error('Failed to download media', error as Error, {
                        chatId,
                        messageId,
                    });
                    // Continue without media
                }
            }

            // Send typing indicator
            await this.whatsappClient.sendTyping(chatId);

            // Enqueue message for processing
            this.queueManager.enqueue({
                chatId,
                messageId,
                messageText,
                isGroup: chat.isGroup,
                userName,
                mediaAttachments,
                timestamp: Date.now(),
            });

            logger.info('Message enqueued', {
                chatId,
                messageId,
                isGroup: chat.isGroup,
                hasMedia: !!mediaAttachments,
            });

        } catch (error) {
            logEvent.error('Failed to handle message', error as Error, {
                messageId: message.id._serialized,
            });
        }
    }

    /**
     * Send response back to WhatsApp chat
     */
    async sendResponse(chatId: string, messageId: string, response: string): Promise<void> {
        try {
            // Clear typing indicator
            await this.whatsappClient.clearTyping(chatId);

            // Send message
            await this.whatsappClient.sendMessage(chatId, response);

            logEvent.whatsappSent(chatId, messageId);

        } catch (error) {
            logEvent.error('Failed to send WhatsApp message', error as Error, {
                chatId,
                messageId,
            });
            throw error;
        }
    }

    /**
     * Send fallback error message
     */
    async sendFallback(chatId: string): Promise<void> {
        try {
            await this.whatsappClient.clearTyping(chatId);

            const fallbackMessage = "I'm sorry, I'm having trouble processing your message right now. Please try again later.";
            await this.whatsappClient.sendMessage(chatId, fallbackMessage);

            logger.info('Fallback message sent', { chatId });

        } catch (error) {
            logEvent.error('Failed to send fallback message', error as Error, {
                chatId,
            });
        }
    }
}
