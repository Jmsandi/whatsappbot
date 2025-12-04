import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './env';
import { logger } from '../utils/logger';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
    if (!supabaseClient) {
        try {
            supabaseClient = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey,
                {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false,
                    },
                }
            );
            logger.info('Supabase client initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Supabase client', error as Error);
            throw error;
        }
    }
    return supabaseClient;
}

/**
 * Test Supabase connection
 */
export async function testSupabaseConnection(): Promise<boolean> {
    try {
        const client = getSupabaseClient();
        const { error } = await client.from('users').select('count').limit(1);

        if (error) {
            logger.error('Supabase connection test failed', error);
            return false;
        }

        logger.info('Supabase connection test successful');
        return true;
    } catch (error) {
        logger.error('Supabase connection test error', error as Error);
        return false;
    }
}
