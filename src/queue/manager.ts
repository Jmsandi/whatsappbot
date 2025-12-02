import { logger } from '../utils/logger';
import { RateLimiter } from '../utils/rate-limiter';
import { config } from '../config/env';

export interface QueuedMessage {
    chatId: string;
    messageId: string;
    messageText: string;
    isGroup: boolean;
    userName?: string;
    mediaAttachments?: Array<{
        filename: string;
        mime: string;
        data_base64: string;
    }>;
    timestamp: number;
}

interface QueueStats {
    totalQueued: number;
    totalProcessed: number;
    totalFailed: number;
    currentQueueLength: number;
    activeWorkers: number;
}

export class QueueManager {
    private queues: Map<string, QueuedMessage[]> = new Map();
    private rateLimiter: RateLimiter;
    private activeWorkers = 0;
    private maxConcurrency: number;
    private stats: QueueStats = {
        totalQueued: 0,
        totalProcessed: 0,
        totalFailed: 0,
        currentQueueLength: 0,
        activeWorkers: 0,
    };

    constructor() {
        this.rateLimiter = new RateLimiter(config.queue.perChatRateLimitMs);
        this.maxConcurrency = config.queue.maxConcurrency;
    }

    /**
     * Add a message to the queue
     */
    enqueue(message: QueuedMessage): void {
        const queue = this.queues.get(message.chatId) || [];
        queue.push(message);
        this.queues.set(message.chatId, queue);

        this.stats.totalQueued++;
        this.updateQueueLength();

        logger.debug('Message enqueued', {
            chatId: message.chatId,
            messageId: message.messageId,
            queueLength: queue.length,
        });

        // Try to process immediately if capacity available
        this.processNext();
    }

    /**
     * Process the next available message from any queue
     */
    private async processNext(): Promise<void> {
        // Check if we have capacity
        if (this.activeWorkers >= this.maxConcurrency) {
            logger.debug('Max concurrency reached', {
                activeWorkers: this.activeWorkers,
                maxConcurrency: this.maxConcurrency,
            });
            return;
        }

        // Find a chat with messages that can be processed
        for (const [chatId, queue] of this.queues.entries()) {
            if (queue.length === 0) {
                continue;
            }

            // Check rate limit
            const delay = this.rateLimiter.checkRateLimit(chatId);
            if (delay > 0) {
                logger.debug('Rate limit active for chat', {
                    chatId,
                    delayMs: delay,
                });

                // Schedule retry after delay
                setTimeout(() => this.processNext(), delay);
                continue;
            }

            // Dequeue and process
            const message = queue.shift()!;
            this.updateQueueLength();

            this.activeWorkers++;
            this.stats.activeWorkers = this.activeWorkers;

            // Process in background
            this.processMessage(message)
                .then(() => {
                    this.stats.totalProcessed++;
                    this.rateLimiter.recordMessage(chatId);
                })
                .catch((error) => {
                    this.stats.totalFailed++;
                    logger.error('Message processing failed', error, {
                        chatId: message.chatId,
                        messageId: message.messageId,
                    });
                })
                .finally(() => {
                    this.activeWorkers--;
                    this.stats.activeWorkers = this.activeWorkers;

                    // Try to process next message
                    this.processNext();
                });

            // Only process one message per call
            return;
        }
    }

    /**
     * Process a single message (to be implemented by worker)
     */
    private async processMessage(message: QueuedMessage): Promise<void> {
        // This will be called by the worker
        // For now, just a placeholder
        logger.debug('Processing message', {
            chatId: message.chatId,
            messageId: message.messageId,
        });
    }

    /**
     * Set the message processor function
     */
    setProcessor(processor: (message: QueuedMessage) => Promise<void>): void {
        this.processMessage = processor;
    }

    /**
     * Get queue statistics
     */
    getStats(): QueueStats {
        return { ...this.stats };
    }

    /**
     * Clear all queues
     */
    clearAll(): void {
        this.queues.clear();
        this.updateQueueLength();
        logger.info('All queues cleared');
    }

    /**
     * Clear queue for a specific chat
     */
    clearChat(chatId: string): void {
        this.queues.delete(chatId);
        this.updateQueueLength();
        logger.info('Chat queue cleared', { chatId });
    }

    private updateQueueLength(): void {
        let total = 0;
        for (const queue of this.queues.values()) {
            total += queue.length;
        }
        this.stats.currentQueueLength = total;
    }
}
