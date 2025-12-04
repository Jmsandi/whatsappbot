import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger';

export interface Message {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolName?: string;
    timestamp: number;
}

export class ConversationHistory {
    private cache: LRUCache<string, Message[]>;
    private maxMessagesPerChat: number;

    constructor(maxChats: number = 1000, maxMessagesPerChat: number = 10) {
        this.maxMessagesPerChat = maxMessagesPerChat;
        this.cache = new LRUCache({
            max: maxChats,
            ttl: 1000 * 60 * 60 * 24, // 24 hours
        });
    }

    /**
     * Add a message to conversation history
     */
    addMessage(chatId: string, message: Message): void {
        const history = this.cache.get(chatId) || [];

        // Add new message
        history.push(message);

        // Keep only last N messages
        const trimmedHistory = history.slice(-this.maxMessagesPerChat);

        this.cache.set(chatId, trimmedHistory);

        logger.debug('Message added to conversation history', {
            chatId,
            role: message.role,
            historyLength: trimmedHistory.length,
        });
    }

    /**
     * Get conversation history for a chat
     */
    getHistory(chatId: string): Message[] {
        return this.cache.get(chatId) || [];
    }

    /**
     * Clear history for a specific chat
     */
    clearHistory(chatId: string): void {
        this.cache.delete(chatId);
        logger.debug('Conversation history cleared', { chatId });
    }

    /**
     * Format history for prompt
     */
    formatForPrompt(chatId: string): string {
        const history = this.getHistory(chatId);

        if (history.length === 0) {
            return '';
        }

        const formatted = history.map(msg => {
            if (msg.role === 'user') {
                return `User: ${msg.content}`;
            } else if (msg.role === 'assistant') {
                return `Assistant: ${msg.content}`;
            } else if (msg.role === 'tool') {
                return `Tool Result (${msg.toolName}): ${msg.content}`;
            }
            return '';
        }).join('\n');

        return `\nCONVERSATION HISTORY:\n${formatted}\n`;
    }

    /**
     * Get recent N messages from conversation history
     */
    getRecentMessages(chatId: string, count: number): Message[] {
        const history = this.getHistory(chatId);
        return history.slice(-count);
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; maxSize: number } {
        return {
            size: this.cache.size,
            maxSize: this.cache.max,
        };
    }
}
