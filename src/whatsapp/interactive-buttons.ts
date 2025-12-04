import { Message } from 'whatsapp-web.js';
import { logger } from '../utils/logger';

export interface QuickReplyButton {
    id: string;
    title: string;
}

export interface ButtonMessage {
    text: string;
    buttons: QuickReplyButton[];
}

/**
 * Create a health awareness message with interactive buttons
 */
export function createHealthAwarenessMessage(
    title: string,
    message: string,
    iconEmoji: string = '🏥'
): string {
    return `${iconEmoji} *${title}*\n\n${message}\n\n*Quick Actions:*\n• Reply *1* for Learn More 📘\n• Reply *2* for Prevention Tips 🛡️\n• Reply *3* to Ask a Question ❓\n• Reply *4* to Share Message 🔄`;
}

/**
 * Create detailed information message
 */
export function createDetailedInfoMessage(
    title: string,
    detailedInfo: string,
    iconEmoji: string = '📘'
): string {
    return `${iconEmoji} *${title} - Detailed Information*\n\n${detailedInfo}\n\n_Reply with any questions you have about this topic._`;
}

/**
 * Create prevention tips message
 */
export function createPreventionTipsMessage(
    title: string,
    tips: string[],
    iconEmoji: string = '🛡️'
): string {
    const formattedTips = tips.map((tip, index) => `${index + 1}. ${tip}`).join('\n\n');
    return `${iconEmoji} *${title} - Prevention Tips*\n\n${formattedTips}\n\n_Follow these steps to stay healthy and safe!_`;
}

/**
 * Create share message
 */
export function createShareMessage(
    title: string,
    message: string,
    tips: string[],
    iconEmoji: string = '🔄'
): string {
    const topTips = tips.slice(0, 3).map((tip, index) => `${index + 1}. ${tip}`).join('\n');
    return `${iconEmoji} *Share This Health Tip!*\n\n*${title}*\n\n${message}\n\n*Top Tips:*\n${topTips}\n\n_Forward this message to help keep your community healthy!_`;
}

/**
 * Detect if message is a button response (1, 2, 3, or 4)
 */
export function isButtonResponse(messageText: string): boolean {
    const trimmed = messageText.trim();
    return /^[1-4]$/.test(trimmed);
}

/**
 * Get button action from response
 */
export function getButtonAction(messageText: string): string | null {
    const trimmed = messageText.trim();
    const buttonMap: { [key: string]: string } = {
        '1': 'learn_more',
        '2': 'prevention_tips',
        '3': 'ask_question',
        '4': 'share'
    };
    return buttonMap[trimmed] || null;
}

/**
 * Format health topic for broadcast
 */
export interface HealthTopic {
    id: string;
    title: string;
    category: string;
    short_message: string;
    detailed_info: string;
    prevention_tips: string[];
    icon_emoji: string;
}

export function formatHealthTopicBroadcast(topic: HealthTopic): string {
    return createHealthAwarenessMessage(
        topic.title,
        topic.short_message,
        topic.icon_emoji
    );
}

/**
 * Handle button interaction and return appropriate response
 */
export async function handleButtonInteraction(
    action: string,
    topic: HealthTopic,
    userId: string,
    broadcastId?: string
): Promise<string> {
    try {
        // Track interaction in database
        if (broadcastId) {
            await trackInteraction(broadcastId, userId, action);
        }

        switch (action) {
            case 'learn_more':
                return createDetailedInfoMessage(
                    topic.title,
                    topic.detailed_info,
                    topic.icon_emoji
                );

            case 'prevention_tips':
                return createPreventionTipsMessage(
                    topic.title,
                    topic.prevention_tips,
                    topic.icon_emoji
                );

            case 'share':
                return createShareMessage(
                    topic.title,
                    topic.short_message,
                    topic.prevention_tips,
                    topic.icon_emoji
                );

            case 'ask_question':
                return `${topic.icon_emoji} *Ask Your Question About ${topic.title}*\n\nI'm here to help! Please type your question about ${topic.title.toLowerCase()}, and I'll do my best to provide accurate information.\n\n_You can ask anything related to this health topic._`;

            default:
                return '';
        }
    } catch (error) {
        logger.error('Error handling button interaction', error as Error);
        return '';
    }
}

/**
 * Track button interaction in database
 */
async function trackInteraction(
    broadcastId: string,
    userId: string,
    interactionType: string
): Promise<void> {
    try {
        const { getSupabaseClient } = await import('../config/supabase');
        const supabase = getSupabaseClient();

        await supabase.from('broadcast_interactions').insert({
            broadcast_id: broadcastId,
            user_id: userId,
            interaction_type: interactionType
        });

        // Increment interaction count on broadcast
        await supabase.rpc('increment', {
            table_name: 'automated_broadcasts',
            row_id: broadcastId,
            column_name: 'interaction_count'
        });

        logger.info('Button interaction tracked', {
            broadcastId,
            userId,
            interactionType
        });
    } catch (error) {
        logger.error('Failed to track interaction', error as Error);
    }
}

/**
 * Store last broadcast topic for user context
 */
const userLastTopicMap = new Map<string, HealthTopic>();

export function setUserLastTopic(userId: string, topic: HealthTopic): void {
    userLastTopicMap.set(userId, topic);
}

export function getUserLastTopic(userId: string): HealthTopic | null {
    return userLastTopicMap.get(userId) || null;
}

export function clearUserLastTopic(userId: string): void {
    userLastTopicMap.delete(userId);
}
