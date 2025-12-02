interface RateLimitEntry {
    lastMessageTime: number;
    messageCount: number;
}

export class RateLimiter {
    private chatLimits: Map<string, RateLimitEntry> = new Map();
    private rateLimitMs: number;

    constructor(rateLimitMs: number) {
        this.rateLimitMs = rateLimitMs;
    }

    /**
     * Check if a message from this chat should be rate limited
     * @param chatId The chat ID to check
     * @returns The delay in ms needed before processing, or 0 if can process immediately
     */
    checkRateLimit(chatId: string): number {
        const now = Date.now();
        const entry = this.chatLimits.get(chatId);

        if (!entry) {
            // First message from this chat
            this.chatLimits.set(chatId, {
                lastMessageTime: now,
                messageCount: 1,
            });
            return 0;
        }

        const timeSinceLastMessage = now - entry.lastMessageTime;

        if (timeSinceLastMessage < this.rateLimitMs) {
            // Need to wait
            return this.rateLimitMs - timeSinceLastMessage;
        }

        // Update last message time
        entry.lastMessageTime = now;
        entry.messageCount++;
        return 0;
    }

    /**
     * Record that a message was processed for this chat
     * @param chatId The chat ID
     */
    recordMessage(chatId: string): void {
        const now = Date.now();
        const entry = this.chatLimits.get(chatId);

        if (entry) {
            entry.lastMessageTime = now;
            entry.messageCount++;
        } else {
            this.chatLimits.set(chatId, {
                lastMessageTime: now,
                messageCount: 1,
            });
        }
    }

    /**
     * Clear rate limit data for a specific chat
     * @param chatId The chat ID to clear
     */
    clearChat(chatId: string): void {
        this.chatLimits.delete(chatId);
    }

    /**
     * Clear all rate limit data
     */
    clearAll(): void {
        this.chatLimits.clear();
    }

    /**
     * Get statistics for monitoring
     */
    getStats() {
        return {
            totalChats: this.chatLimits.size,
            rateLimitMs: this.rateLimitMs,
        };
    }
}
