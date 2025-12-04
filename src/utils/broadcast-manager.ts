import { getSupabaseClient } from '../config/supabase';
import { logger } from '../utils/logger';
import { HealthTopic, formatHealthTopicBroadcast } from '../whatsapp/interactive-buttons';

/**
 * Get a random active health topic weighted by priority
 */
export async function getRandomHealthTopic(): Promise<HealthTopic | null> {
    try {
        const supabase = getSupabaseClient();

        // Get all active topics
        const { data: topics, error } = await supabase
            .from('health_topics')
            .select('*')
            .eq('is_active', true)
            .order('priority', { ascending: false });

        if (error || !topics || topics.length === 0) {
            logger.error('No active health topics found', error);
            return null;
        }

        // Weighted random selection based on priority
        const totalWeight = topics.reduce((sum, topic) => sum + topic.priority, 0);
        let random = Math.random() * totalWeight;

        for (const topic of topics) {
            random -= topic.priority;
            if (random <= 0) {
                return topic as HealthTopic;
            }
        }

        // Fallback to first topic
        return topics[0] as HealthTopic;
    } catch (error) {
        logger.error('Error getting random health topic', error as Error);
        return null;
    }
}

/**
 * Get health topic by ID
 */
export async function getHealthTopicById(topicId: string): Promise<HealthTopic | null> {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('health_topics')
            .select('*')
            .eq('id', topicId)
            .single();

        if (error || !data) {
            logger.error('Health topic not found', error);
            return null;
        }

        return data as HealthTopic;
    } catch (error) {
        logger.error('Error getting health topic', error as Error);
        return null;
    }
}

/**
 * Get all subscribed users for broadcast
 */
export async function getSubscribedUsers(): Promise<Array<{ id: string; phone: string; name?: string }>> {
    try {
        const supabase = getSupabaseClient();

        const { data: users, error } = await supabase
            .from('users')
            .select('id, phone, name')
            .eq('subscribed_to_broadcasts', true)
            .eq('status', 'active');

        if (error) {
            logger.error('Error getting subscribed users', error);
            return [];
        }

        return users || [];
    } catch (error) {
        logger.error('Error getting subscribed users', error as Error);
        return [];
    }
}

/**
 * Create automated broadcast record
 */
export async function createAutomatedBroadcast(
    topicId: string,
    scheduledAt: Date
): Promise<string | null> {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('automated_broadcasts')
            .insert({
                topic_id: topicId,
                scheduled_at: scheduledAt.toISOString(),
                status: 'scheduled'
            })
            .select('id')
            .single();

        if (error || !data) {
            logger.error('Failed to create automated broadcast', error);
            return null;
        }

        logger.info('Automated broadcast created', { broadcastId: data.id, topicId });
        return data.id;
    } catch (error) {
        logger.error('Error creating automated broadcast', error as Error);
        return null;
    }
}

/**
 * Update broadcast status and counts
 */
export async function updateBroadcastStatus(
    broadcastId: string,
    status: string,
    targetCount?: number,
    deliveredCount?: number
): Promise<void> {
    try {
        const supabase = getSupabaseClient();

        const updateData: any = {
            status,
            updated_at: new Date().toISOString()
        };

        if (status === 'sent') {
            updateData.sent_at = new Date().toISOString();
        }

        if (targetCount !== undefined) {
            updateData.target_count = targetCount;
        }

        if (deliveredCount !== undefined) {
            updateData.delivered_count = deliveredCount;
        }

        await supabase
            .from('automated_broadcasts')
            .update(updateData)
            .eq('id', broadcastId);

        logger.info('Broadcast status updated', { broadcastId, status });
    } catch (error) {
        logger.error('Error updating broadcast status', error as Error);
    }
}

/**
 * Update user's last broadcast received timestamp
 */
export async function updateUserLastBroadcast(userId: string): Promise<void> {
    try {
        const supabase = getSupabaseClient();

        await supabase
            .from('users')
            .update({ last_broadcast_received: new Date().toISOString() })
            .eq('id', userId);
    } catch (error) {
        logger.error('Error updating user last broadcast', error as Error);
    }
}

/**
 * Increment topic sent count
 */
export async function incrementTopicSentCount(topicId: string): Promise<void> {
    try {
        const supabase = getSupabaseClient();

        const { data: topic } = await supabase
            .from('health_topics')
            .select('times_sent')
            .eq('id', topicId)
            .single();

        if (topic) {
            await supabase
                .from('health_topics')
                .update({ times_sent: (topic.times_sent || 0) + 1 })
                .eq('id', topicId);
        }
    } catch (error) {
        logger.error('Error incrementing topic sent count', error as Error);
    }
}

/**
 * Check if it's time to send automated broadcast (every 3 days)
 */
export async function shouldSendAutomatedBroadcast(): Promise<boolean> {
    try {
        const supabase = getSupabaseClient();

        // Get last sent broadcast
        const { data: lastBroadcast } = await supabase
            .from('automated_broadcasts')
            .select('sent_at')
            .eq('status', 'sent')
            .order('sent_at', { ascending: false })
            .limit(1)
            .single();

        if (!lastBroadcast || !lastBroadcast.sent_at) {
            // No broadcast sent yet, send one
            return true;
        }

        const lastSentDate = new Date(lastBroadcast.sent_at);
        const now = new Date();
        const daysSinceLastBroadcast = (now.getTime() - lastSentDate.getTime()) / (1000 * 60 * 60 * 24);

        // Send if 3 or more days have passed
        return daysSinceLastBroadcast >= 3;
    } catch (error) {
        logger.error('Error checking broadcast schedule', error as Error);
        return false;
    }
}

/**
 * Get next scheduled broadcast time (3 days from last broadcast)
 */
export async function getNextBroadcastTime(): Promise<Date> {
    try {
        const supabase = getSupabaseClient();

        const { data: lastBroadcast } = await supabase
            .from('automated_broadcasts')
            .select('sent_at')
            .eq('status', 'sent')
            .order('sent_at', { ascending: false })
            .limit(1)
            .single();

        if (!lastBroadcast || !lastBroadcast.sent_at) {
            // No previous broadcast, schedule for now
            return new Date();
        }

        const lastSentDate = new Date(lastBroadcast.sent_at);
        const nextBroadcastDate = new Date(lastSentDate.getTime() + (3 * 24 * 60 * 60 * 1000));

        return nextBroadcastDate;
    } catch (error) {
        logger.error('Error getting next broadcast time', error as Error);
        // Default to 3 days from now
        return new Date(Date.now() + (3 * 24 * 60 * 60 * 1000));
    }
}
