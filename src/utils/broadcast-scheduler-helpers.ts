import { getSupabaseClient } from '../config/supabase';
import { logger } from '../utils/logger';

/**
 * Check if it's time to send automated broadcast
 * In test mode: every 2 minutes
 * In production: every 3 days
 */
export async function shouldSendAutomatedBroadcast(testMode: boolean = false): Promise<boolean> {
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
            logger.info('No previous broadcast found, ready to send');
            return true;
        }

        const lastSentDate = new Date(lastBroadcast.sent_at);
        const now = new Date();
        const timeSinceLastBroadcast = now.getTime() - lastSentDate.getTime();

        if (testMode) {
            // Test mode: send every 2 minutes
            const minutesSinceLastBroadcast = timeSinceLastBroadcast / (1000 * 60);
            logger.debug('Checking broadcast schedule (TEST MODE)', {
                minutesSinceLastBroadcast: minutesSinceLastBroadcast.toFixed(2),
                threshold: 2
            });
            return minutesSinceLastBroadcast >= 2;
        } else {
            // Production mode: send every 3 days
            const daysSinceLastBroadcast = timeSinceLastBroadcast / (1000 * 60 * 60 * 24);
            logger.debug('Checking broadcast schedule (PRODUCTION)', {
                daysSinceLastBroadcast: daysSinceLastBroadcast.toFixed(2),
                threshold: 3
            });
            return daysSinceLastBroadcast >= 3;
        }
    } catch (error) {
        logger.error('Error checking broadcast schedule', error as Error);
        return false;
    }
}

/**
 * Get next scheduled broadcast time
 */
export async function getNextBroadcastTime(testMode: boolean = false): Promise<Date> {
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

        if (testMode) {
            // Test mode: 2 minutes from last broadcast
            return new Date(lastSentDate.getTime() + (2 * 60 * 1000));
        } else {
            // Production mode: 3 days from last broadcast
            return new Date(lastSentDate.getTime() + (3 * 24 * 60 * 60 * 1000));
        }
    } catch (error) {
        logger.error('Error getting next broadcast time', error as Error);
        // Default based on mode
        if (testMode) {
            return new Date(Date.now() + (2 * 60 * 1000));
        } else {
            return new Date(Date.now() + (3 * 24 * 60 * 60 * 1000));
        }
    }
}
