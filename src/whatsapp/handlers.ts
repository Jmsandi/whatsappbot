import { Message } from 'whatsapp-web.js';
import { WhatsAppClient } from './client';
import { QueueManager } from '../queue/manager';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { upsertUser, storeMessage, getUserIdByPhone, incrementUserMessageCount } from '../utils/database-sync';

export class MessageHandler {
    private whatsappClient: WhatsAppClient;
    private queueManager: QueueManager;
    private config: typeof config;

    constructor(whatsappClient: WhatsAppClient, queueManager: QueueManager) {
        this.whatsappClient = whatsappClient;
        this.queueManager = queueManager;
        this.config = config;
    }

    /**
     * Extracts the content of a message, handling various message types.
     */
    private async extractMessageContent(message: Message): Promise<string | undefined> {
        if (message.body && message.body.trim().length > 0) {
            return message.body;
        }

        // Handle quoted messages
        if (message.hasQuotedMsg) {
            try {
                const quotedMsg = await message.getQuotedMessage();
                if (quotedMsg.body && quotedMsg.body.trim().length > 0) {
                    return quotedMsg.body;
                }
            } catch (error) {
                logger.debug('Could not get quoted message body', { error: (error as Error).message });
            }
        }

        return undefined;
    }

    /**
     * Handle incoming WhatsApp message
     */
    async handleMessage(message: Message): Promise<void> {
        try {
            const chatId = message.from;
            const messageId = message.id._serialized;

            // Early filtering - ignore unsupported message types
            if (chatId.includes('@newsletter')) {
                logger.debug('Ignoring newsletter message', { chatId, messageId });
                return;
            }

            if (chatId.includes('@broadcast')) {
                logger.debug('Ignoring broadcast message', { chatId, messageId });
                return;
            }

            if (chatId.includes('status@broadcast')) {
                logger.debug('Ignoring status message', { chatId, messageId });
                return;
            }

            // Filter out group messages if configured
            if (!this.config.whatsapp.allowGroupMessages && chatId.includes('@g.us')) {
                logger.debug('Ignoring group message', { chatId, messageId });
                return;
            }

            const messageText = await this.extractMessageContent(message);

            // Get message content
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
                // Fallback: Try to get from message metadata
                logger.debug('Could not fetch contact info, using fallback', {
                    chatId,
                    messageId,
                    error: (error as Error).message
                });
                userName = undefined;
            }

            logger.info('Handling message', {
                from: chatId,
                hasText: !!messageText,
                userName,
            });

            // Sync user to database (async, non-blocking)
            const phone = chatId.split('@')[0]; // Extract phone number from chatId
            this.syncUserToDatabase(phone, userName).catch(err => {
                logger.error('Failed to sync user to database', err);
            });

            // Store user message in database (async, non-blocking)
            this.storeUserMessage(phone, messageText).catch(err => {
                logger.error('Failed to store user message', err);
            });

            // Check if message is a button response (1, 2, 3, or 4)
            const { isButtonResponse, getButtonAction, getUserLastTopic, handleButtonInteraction } = await import('./interactive-buttons');

            if (isButtonResponse(messageText)) {
                const action = getButtonAction(messageText);
                const userId = await this.getUserIdByPhone(phone);

                if (action && userId) {
                    const lastTopic = getUserLastTopic(userId);

                    if (lastTopic) {
                        logger.info('Handling button interaction', { action, userId, topicId: lastTopic.id });

                        const response = await handleButtonInteraction(action, lastTopic, userId);

                        if (response) {
                            await this.sendResponse(chatId, response);
                            return; // Don't process as regular message
                        }
                    }
                }
            }

            // Send typing indicator (with error handling for unsupported chats)
            try {
                await this.whatsappClient.sendTyping(chatId);
            } catch (typingError) {
                logger.debug('Could not send typing indicator', { error: (typingError as Error).message });
                // Continue processing even if typing fails
            }

            // Get chat object for isGroup check
            const chat = await message.getChat();

            // Enqueue message for processing
            this.queueManager.enqueue({
                chatId,
                messageId,
                messageText,
                isGroup: chat.isGroup,
                userName,
                timestamp: Date.now(),
            });

        } catch (error) {
            logger.error('Failed to handle message', error as Error, {
                event: 'error',
                error: (error as Error).message,
                stack: (error as Error).stack,
                messageId: message?.id?._serialized,
            });
        }
    }

    /**
     * Send bot response to user
     */
    async sendResponse(chatId: string, responseText: string): Promise<void> {
        try {
            await this.whatsappClient.sendMessage(chatId, responseText);
            logger.info('Response sent', { chatId });

            // Store bot message in database (async, non-blocking)
            const phone = chatId.split('@')[0];
            this.storeBotMessage(phone, responseText).catch(err => {
                logger.error('Failed to store bot message', err);
            });

        } catch (error) {
            logger.error('Failed to send response', error as Error, { chatId });
            throw error;
        }
    }

    /**
     * Sync user data to database
     */
    private async syncUserToDatabase(phone: string, name?: string): Promise<void> {
        try {
            const userId = await upsertUser({ phone, name });
            if (userId) {
                await incrementUserMessageCount(userId);
            }
        } catch (error) {
            logger.error('Database sync failed for user', error as Error, { phone });
        }
    }

    /**
     * Store user message in database and check for escalation
     */
    private async storeUserMessage(phone: string, content: string): Promise<string | null> {
        try {
            const userId = await getUserIdByPhone(phone);
            if (userId) {
                const messageId = await storeMessage({
                    user_id: userId,
                    sender: 'user',
                    content,
                });

                // Check if message should be escalated
                if (messageId) {
                    this.checkAndEscalate(userId, messageId, content).catch(err => {
                        logger.error('Failed to check escalation', err);
                    });
                }

                return messageId;
            }
            return null;
        } catch (error) {
            logger.error('Failed to store user message in database', error as Error, { phone });
            return null;
        }
    }

    /**
     * Store bot response in database
     */
    private async storeBotMessage(phone: string, content: string): Promise<void> {
        try {
            const userId = await getUserIdByPhone(phone);
            if (userId) {
                await storeMessage({
                    user_id: userId,
                    sender: 'bot',
                    content,
                });
            }
        } catch (error) {
            logger.error('Failed to store bot message in database', error as Error, { phone });
        }
    }

    /**
     * Check if message should be escalated and create escalation if needed
     */
    private async checkAndEscalate(userId: string, messageId: string, content: string): Promise<void> {
        try {
            const { checkForEscalation, createEscalation } = await import('../utils/escalation-detector');

            const escalationCheck = await checkForEscalation(content);

            if (escalationCheck.shouldEscalate) {
                logger.info('Escalation triggered', {
                    userId,
                    messageId,
                    reason: escalationCheck.reason,
                    triggerType: escalationCheck.triggerType
                });

                // Create escalation record
                const escalationId = await createEscalation({
                    userId,
                    messageId,
                    reason: escalationCheck.reason || 'Escalation triggered',
                    triggerType: escalationCheck.triggerType || 'keyword',
                    priority: escalationCheck.priority || 'normal',
                    messageContent: content
                });

                if (escalationId && escalationCheck.response) {
                    // Send acknowledgment to user
                    const chatId = await this.getChatIdFromUserId(userId);
                    if (chatId) {
                        await this.sendResponse(chatId, escalationCheck.response);
                    }
                }
            }
        } catch (error) {
            logger.error('Error in escalation check', error as Error);
        }
    }

    /**
     * Get WhatsApp chat ID from user ID
     */
    private async getChatIdFromUserId(userId: string): Promise<string | null> {
        try {
            const { getSupabaseClient } = await import('../config/supabase');
            const supabase = getSupabaseClient();

            const { data, error } = await supabase
                .from('users')
                .select('phone')
                .eq('id', userId)
                .single();

            if (error || !data) {
                return null;
            }

            return `${data.phone}@c.us`;
        } catch (error) {
            logger.error('Failed to get chat ID from user ID', error as Error);
            return null;
        }
    }

    /**
     * Get user ID by phone number
     */
    private async getUserIdByPhone(phone: string): Promise<string | null> {
        try {
            const { getUserIdByPhone } = await import('../utils/database-sync');
            return await getUserIdByPhone(phone);
        } catch (error) {
            logger.error('Failed to get user ID by phone', error as Error);
            return null;
        }
    }
}
