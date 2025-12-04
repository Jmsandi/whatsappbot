import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/supabase';
import { WhatsAppClient } from '../whatsapp/client';

interface BroadcastSettings {
    id: string;
    auto_send_enabled: boolean;
    interval_value: number;
    interval_unit: string;
    last_broadcast_at: string | null;
    next_broadcast_at: string | null;
}

interface HealthTopic {
    id: string;
    title: string;
    category: string;
    short_message: string;
    detailed_info: string;
    prevention_tips: string[];
    icon_emoji: string;
    is_active: boolean;
    priority: number;
    times_sent: number;
}

/**
 * Check if it's time to send a broadcast and send if needed
 */
export async function checkAndSendBroadcasts(whatsappClient: WhatsAppClient): Promise<void> {
    try {
        const supabase = getSupabaseClient();

        // Get broadcast settings
        const { data: settings, error: settingsError } = await supabase
            .from('broadcast_settings')
            .select('*')
            .single();

        if (settingsError || !settings) {
            logger.debug('No broadcast settings found or error fetching settings');
            return;
        }

        const broadcastSettings = settings as BroadcastSettings;

        // Check if auto-send is enabled
        if (!broadcastSettings.auto_send_enabled) {
            logger.debug('Auto-send is disabled');
            return;
        }

        // Check if it's time to send
        const now = new Date();
        const nextBroadcast = broadcastSettings.next_broadcast_at
            ? new Date(broadcastSettings.next_broadcast_at)
            : null;

        if (!nextBroadcast || now < nextBroadcast) {
            logger.debug('Not time to send broadcast yet', {
                now: now.toISOString(),
                nextBroadcast: nextBroadcast?.toISOString()
            });
            return;
        }

        logger.info('Time to send automated broadcast!');

        // Send the broadcast
        await sendAutomatedBroadcast(whatsappClient, broadcastSettings);

    } catch (error) {
        logger.error('Error in checkAndSendBroadcasts', error as Error);
    }
}

/**
 * Send an automated broadcast to all subscribed users
 */
async function sendAutomatedBroadcast(
    whatsappClient: WhatsAppClient,
    settings: BroadcastSettings
): Promise<void> {
    try {
        const supabase = getSupabaseClient();

        // Get a random active topic
        const { data: topics, error: topicsError } = await supabase
            .from('health_topics')
            .select('*')
            .eq('is_active', true)
            .order('times_sent', { ascending: true })
            .limit(5);

        if (topicsError || !topics || topics.length === 0) {
            logger.error('No active health topics found for broadcast');
            return;
        }

        // Select random topic from the 5 least-sent topics
        const topic = topics[Math.floor(Math.random() * topics.length)] as HealthTopic;

        logger.info('Selected topic for broadcast', {
            topicId: topic.id,
            title: topic.title,
            timesSent: topic.times_sent
        });

        // Get all subscribed users
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, phone, name')
            .eq('subscribed_to_broadcasts', true);

        if (usersError || !users || users.length === 0) {
            logger.warn('No subscribed users found for broadcast');
            return;
        }

        logger.info(`Sending broadcast to ${users.length} users`);

        // Create broadcast record
        const { data: broadcast, error: broadcastError } = await supabase
            .from('automated_broadcasts')
            .insert({
                topic_id: topic.id,
                scheduled_at: new Date().toISOString(),
                target_count: users.length,
                status: 'sending'
            })
            .select()
            .single();

        if (broadcastError || !broadcast) {
            logger.error('Failed to create broadcast record', broadcastError);
            return;
        }

        // Send messages to all users
        let deliveredCount = 0;
        for (const user of users) {
            try {
                const chatId = `${user.phone}@c.us`;
                const message = formatBroadcastMessage(topic);

                await whatsappClient.sendMessage(chatId, message);
                deliveredCount++;

                // Update user's last_broadcast_received
                await supabase
                    .from('users')
                    .update({ last_broadcast_received: new Date().toISOString() })
                    .eq('id', user.id);

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                logger.error('Failed to send broadcast to user', error as Error, {
                    userId: user.id,
                    phone: user.phone
                });
            }
        }

        // Update broadcast record
        await supabase
            .from('automated_broadcasts')
            .update({
                sent_at: new Date().toISOString(),
                delivered_count: deliveredCount,
                status: 'sent'
            })
            .eq('id', broadcast.id);

        // Update topic times_sent
        await supabase
            .from('health_topics')
            .update({ times_sent: topic.times_sent + 1 })
            .eq('id', topic.id);

        // Calculate next broadcast time
        const nextBroadcastTime = calculateNextBroadcastTime(
            settings.interval_value,
            settings.interval_unit
        );

        // Update broadcast settings
        await supabase
            .from('broadcast_settings')
            .update({
                last_broadcast_at: new Date().toISOString(),
                next_broadcast_at: nextBroadcastTime
            })
            .eq('id', settings.id);

        logger.info('Broadcast completed successfully', {
            topicId: topic.id,
            delivered: deliveredCount,
            total: users.length,
            nextBroadcast: nextBroadcastTime
        });

    } catch (error) {
        logger.error('Error sending automated broadcast', error as Error);
    }
}

/**
 * Format the broadcast message with topic content
 */
function formatBroadcastMessage(topic: HealthTopic): string {
    let message = `${topic.icon_emoji} *${topic.title}*\n\n`;
    message += `${topic.short_message}\n\n`;

    if (topic.prevention_tips && topic.prevention_tips.length > 0) {
        message += `*Prevention Tips:*\n`;
        topic.prevention_tips.forEach((tip, index) => {
            message += `${index + 1}. ${tip}\n`;
        });
        message += `\n`;
    }

    message += `_Reply with:_\n`;
    message += `📘 "Learn More" for detailed information\n`;
    message += `🛡️ "Prevention Tips" to see all tips\n`;
    message += `❓ "Ask Question" to speak with a health worker\n\n`;
    message += `_Stay healthy! 🌟_`;

    return message;
}

/**
 * Calculate the next broadcast time based on interval
 */
function calculateNextBroadcastTime(intervalValue: number, intervalUnit: string): string {
    const now = new Date();
    let nextTime = new Date(now);

    switch (intervalUnit) {
        case 'minutes':
            nextTime.setMinutes(now.getMinutes() + intervalValue);
            break;
        case 'hours':
            nextTime.setHours(now.getHours() + intervalValue);
            break;
        case 'days':
            nextTime.setDate(now.getDate() + intervalValue);
            break;
        case 'weeks':
            nextTime.setDate(now.getDate() + (intervalValue * 7));
            break;
        case 'months':
            nextTime.setMonth(now.getMonth() + intervalValue);
            break;
        default:
            nextTime.setDate(now.getDate() + intervalValue);
    }

    return nextTime.toISOString();
}
