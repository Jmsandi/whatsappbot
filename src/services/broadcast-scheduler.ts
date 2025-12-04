import { Client } from 'whatsapp-web.js';
import { logger } from '../utils/logger';
import {
    getRandomHealthTopic,
    getSubscribedUsers,
    createAutomatedBroadcast,
    updateBroadcastStatus,
    updateUserLastBroadcast,
    incrementTopicSentCount
} from '../utils/broadcast-manager';
import { formatHealthTopicBroadcast, setUserLastTopic } from '../whatsapp/interactive-buttons';

export class BroadcastScheduler {
    private whatsappClient: Client;
    private schedulerInterval: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private testMode: boolean = false;

    constructor(whatsappClient: Client, testMode: boolean = false) {
        this.whatsappClient = whatsappClient;
        this.testMode = testMode;

        if (testMode) {
            logger.warn('⚠️  BROADCAST SCHEDULER IN TEST MODE - Sending every 2 minutes!');
        }
    }

    /**
     * Start the automated broadcast scheduler
     * Checks every hour if it's time to send a broadcast (or every 2 minutes in test mode)
     */
    start(): void {
        if (this.isRunning) {
            logger.warn('Broadcast scheduler already running');
            return;
        }

        const checkInterval = this.testMode ? 1000 * 60 * 2 : 1000 * 60 * 60; // 2 min in test, 1 hour in prod
        const intervalLabel = this.testMode ? '2 minutes' : '1 hour';

        logger.info('Starting automated broadcast scheduler', {
            testMode: this.testMode,
            checkInterval: intervalLabel
        });
        this.isRunning = true;

        // Check immediately on start
        this.checkAndSendBroadcast();

        // Then check at intervals
        this.schedulerInterval = setInterval(() => {
            this.checkAndSendBroadcast();
        }, checkInterval);
    }

    /**
     * Stop the scheduler
     */
    stop(): void {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }
        this.isRunning = false;
        logger.info('Broadcast scheduler stopped');
    }

    /**
     * Check if broadcast should be sent and send it
     */
    private async checkAndSendBroadcast(): Promise<void> {
        try {
            const { shouldSendAutomatedBroadcast, getNextBroadcastTime } = await import('../utils/broadcast-scheduler-helpers');

            const shouldSend = await shouldSendAutomatedBroadcast(this.testMode);

            if (shouldSend) {
                logger.info('⏰ Time to send automated broadcast!', { testMode: this.testMode });
                await this.sendAutomatedBroadcast();
            } else {
                const nextTime = await getNextBroadcastTime(this.testMode);
                logger.debug('Next broadcast scheduled for', {
                    nextTime,
                    testMode: this.testMode
                });
            }
        } catch (error) {
            logger.error('Error in broadcast scheduler', error as Error);
        }
    }

    /**
     * Send automated health awareness broadcast
     */
    async sendAutomatedBroadcast(): Promise<{ success: boolean; broadcastId?: string; error?: string }> {
        try {
            logger.info('Starting automated broadcast');

            // Select random health topic
            const topic = await getRandomHealthTopic();
            if (!topic) {
                logger.error('No health topic available for broadcast');
                return { success: false, error: 'No health topic available' };
            }

            logger.info('Selected health topic for broadcast', { topicId: topic.id, title: topic.title });

            // Get subscribed users
            const users = await getSubscribedUsers();
            if (users.length === 0) {
                logger.warn('No subscribed users for broadcast');
                return { success: false, error: 'No subscribed users' };
            }

            logger.info('Found subscribed users', { count: users.length });

            // Create broadcast record
            const broadcastId = await createAutomatedBroadcast(topic.id, new Date());
            if (!broadcastId) {
                logger.error('Failed to create broadcast record');
                return { success: false, error: 'Failed to create broadcast record' };
            }

            // Update status to sending
            await updateBroadcastStatus(broadcastId, 'sending', users.length, 0);

            // Format message
            const message = formatHealthTopicBroadcast(topic);

            // Send to all users
            let deliveredCount = 0;
            for (const user of users) {
                try {
                    const chatId = `${user.phone}@c.us`;
                    await this.whatsappClient.sendMessage(chatId, message);

                    // Store topic context for button responses
                    setUserLastTopic(user.id, topic);

                    // Update user's last broadcast received
                    await updateUserLastBroadcast(user.id);

                    deliveredCount++;
                    logger.debug('Broadcast sent to user', { userId: user.id, phone: user.phone });

                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    logger.error('Failed to send broadcast to user', error as Error, { userId: user.id });
                }
            }

            // Update broadcast status
            await updateBroadcastStatus(broadcastId, 'sent', users.length, deliveredCount);

            // Increment topic sent count
            await incrementTopicSentCount(topic.id);

            logger.info('Automated broadcast completed', {
                broadcastId,
                topicId: topic.id,
                targetCount: users.length,
                deliveredCount
            });

            return { success: true, broadcastId };
        } catch (error) {
            logger.error('Error sending automated broadcast', error as Error);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Manually trigger a broadcast (for testing or admin action)
     */
    async triggerManualBroadcast(topicId?: string): Promise<{ success: boolean; broadcastId?: string; error?: string }> {
        logger.info('Manual broadcast triggered', { topicId });
        return this.sendAutomatedBroadcast();
    }
}
