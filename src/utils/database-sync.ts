import { getSupabaseClient } from '../config/supabase';
import { logger } from './logger';

interface UserData {
    phone: string;
    name?: string;
    role?: string;
}

interface MessageData {
    user_id: string;
    sender: 'user' | 'bot';
    content: string;
    intent?: string;
}

interface LogData {
    action: string;
    action_type: 'create' | 'update' | 'delete' | 'login' | 'export' | 'broadcast' | 'settings';
    admin_name?: string;
    details?: Record<string, unknown>;
}

/**
 * Create or update a user in the database
 */
export async function upsertUser(userData: UserData): Promise<string | null> {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('users')
            .upsert({
                phone: userData.phone,
                name: userData.name,
                role: userData.role || 'support', // Default to support role
                last_active: new Date().toISOString(),
                status: 'active',
            }, {
                onConflict: 'phone',
                ignoreDuplicates: false,
            })
            .select('id')
            .single();

        if (error) {
            logger.error('Failed to upsert user', error);
            return null;
        }

        return data?.id || null;
    } catch (error) {
        logger.error('Error upserting user', error as Error);
        return null;
    }
}

/**
 * Get user ID by phone number
 */
export async function getUserIdByPhone(phone: string): Promise<string | null> {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('phone', phone)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No user found, this is okay
                return null;
            }
            logger.error('Failed to get user by phone', error);
            return null;
        }

        return data?.id || null;
    } catch (error) {
        logger.error('Error getting user by phone', error as Error);
        return null;
    }
}

/**
 * Store a message in the database
 */
export async function storeMessage(message: {
    user_id: string;
    sender: 'user' | 'bot';
    content: string;
    intent?: string;
}): Promise<string | null> {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('messages')
            .insert({
                user_id: message.user_id,
                sender: message.sender,
                content: message.content,
                intent: message.intent || null,
                is_handled: message.sender === 'bot', // Bot messages are considered handled
            })
            .select('id')
            .single();

        if (error) {
            logger.error('Failed to store message', error);
            return null;
        }

        logger.debug('Message stored in database', { messageId: data.id, sender: message.sender });
        return data.id;
    } catch (error) {
        logger.error('Error storing message', error as Error);
        return null;
    }
}

/**
 * Increment user message count
 */
export async function incrementUserMessageCount(userId: string): Promise<void> {
    try {
        const supabase = getSupabaseClient();

        // Get current count and increment
        const { data, error: fetchError } = await supabase
            .from('users')
            .select('messages_count')
            .eq('id', userId)
            .single();

        if (fetchError) {
            logger.error('Failed to fetch message count', fetchError);
            return;
        }

        // Update with incremented count
        const { error: updateError } = await supabase
            .from('users')
            .update({
                messages_count: (data?.messages_count || 0) + 1,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (updateError) {
            logger.error('Failed to increment message count', updateError);
        }
    } catch (error) {
        logger.error('Error incrementing message count', error as Error);
    }
}

/**
 * Log system events
 */
export async function createSystemLog(logData: LogData): Promise<void> {
    try {
        const supabase = getSupabaseClient();

        const { error } = await supabase
            .from('system_logs')
            .insert({
                action: logData.action,
                action_type: logData.action_type,
                admin_name: logData.admin_name || 'System',
                details: logData.details,
            });

        if (error) {
            logger.error('Failed to create system log', error);
        }
    } catch (error) {
        logger.error('Error creating system log', error as Error);
    }
}

/**
 * Get bot settings from database
 */
export async function getBotSettings(): Promise<Record<string, string>> {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('bot_settings')
            .select('key, value');

        if (error) {
            logger.error('Failed to get bot settings', error);
            return {};
        }

        const settings: Record<string, string> = {};
        data?.forEach((setting) => {
            if (setting.value) {
                settings[setting.key] = setting.value;
            }
        });

        return settings;
    } catch (error) {
        logger.error('Error getting bot settings', error as Error);
        return {};
    }
}

/**
 * Update bot setting in database
 */
export async function updateBotSetting(key: string, value: string, updatedBy: string): Promise<void> {
    try {
        const supabase = getSupabaseClient();

        const { error } = await supabase
            .from('bot_settings')
            .upsert({
                key,
                value,
                updated_by: updatedBy,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'key',
            });

        if (error) {
            logger.error('Failed to update bot setting', error);
        }
    } catch (error) {
        logger.error('Error updating bot setting', error as Error);
    }
}
