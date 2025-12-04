/**
 * Role Manager
 * Utilities for managing user roles and permissions
 */

import { getSupabaseClient } from '../config/supabase';
import { logger } from './logger';
import {
    UserRole,
    RoleAction,
    parseRole,
    canPerformAction as checkPermission,
    getEscalationTarget as getNextEscalationLevel,
    getRoleCapabilities,
    ROLE_DISPLAY_NAMES
} from '../types/role-types';

/**
 * Get user's current role from database
 * Checks special_contacts table first (admin-assigned roles), then users table
 */
export async function getUserRole(userId: string): Promise<UserRole> {
    try {
        const supabase = getSupabaseClient();

        // Get user's phone number first
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('phone, role')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            logger.warn('Failed to get user, using default role', { userId, error: userError });
            return UserRole.SUPPORT;
        }

        // Check if user is in special_contacts (admin-assigned roles take priority)
        if (userData.phone) {
            const { data: specialContact } = await supabase
                .from('special_contacts')
                .select('role')
                .eq('phone', userData.phone)
                .eq('status', 'active')
                .single();

            if (specialContact?.role) {
                logger.debug('Role found in special_contacts', { userId, phone: userData.phone, role: specialContact.role });
                return parseRole(specialContact.role, UserRole.SUPPORT);
            }
        }

        // Use role from users table
        return parseRole(userData.role, UserRole.SUPPORT);
    } catch (error) {
        logger.error('Error getting user role', error as Error, { userId });
        return UserRole.SUPPORT;
    }
}

/**
 * Get user's role by phone number
 * Checks special_contacts table first (admin-assigned roles), then users table
 */
export async function getUserRoleByPhone(phone: string): Promise<UserRole> {
    try {
        const supabase = getSupabaseClient();

        // First, check if user is in special_contacts (admin-assigned roles take priority)
        const { data: specialContact, error: specialError } = await supabase
            .from('special_contacts')
            .select('role')
            .eq('phone', phone)
            .eq('status', 'active')
            .single();

        if (!specialError && specialContact?.role) {
            logger.debug('Role found in special_contacts', { phone, role: specialContact.role });
            return parseRole(specialContact.role, UserRole.SUPPORT);
        }

        // Fall back to users table
        const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('phone', phone)
            .single();

        if (error || !data) {
            logger.debug('User not found or no role set, using default', { phone });
            return UserRole.SUPPORT;
        }

        return parseRole(data.role, UserRole.SUPPORT);
    } catch (error) {
        logger.error('Error getting user role by phone', error as Error, { phone });
        return UserRole.SUPPORT;
    }
}

/**
 * Set user's role in database
 */
export async function setUserRole(userId: string, role: UserRole): Promise<boolean> {
    try {
        const supabase = getSupabaseClient();

        const { error } = await supabase
            .from('users')
            .update({
                role,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) {
            logger.error('Failed to set user role', error);
            return false;
        }

        logger.info('User role updated', { userId, role });
        return true;
    } catch (error) {
        logger.error('Error setting user role', error as Error, { userId, role });
        return false;
    }
}

/**
 * Check if a role can perform a specific action
 */
export function canPerformAction(role: UserRole, action: RoleAction): boolean {
    return checkPermission(role, action);
}

/**
 * Get the escalation target for a given role
 */
export function getEscalationTarget(currentRole: UserRole): UserRole | null {
    return getNextEscalationLevel(currentRole);
}

/**
 * Get all capabilities for a role
 */
export function getCapabilities(role: UserRole): RoleAction[] {
    return getRoleCapabilities(role);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
    return ROLE_DISPLAY_NAMES[role];
}

/**
 * Check if a user should be escalated based on their role and the required action
 */
export function shouldEscalateForAction(userRole: UserRole, requiredAction: RoleAction): boolean {
    return !canPerformAction(userRole, requiredAction);
}

/**
 * Get escalation message for a specific role
 */
export function getEscalationMessage(fromRole: UserRole, reason: string): string {
    const targetRole = getEscalationTarget(fromRole);

    if (!targetRole) {
        // Admin level - recommend facility referral for emergencies
        return `This situation may require immediate medical attention. Please visit the nearest health facility or call emergency services.`;
    }

    const targetRoleName = getRoleDisplayName(targetRole);

    switch (fromRole) {
        case UserRole.SUPPORT:
            return `This issue requires a health worker. I will escalate your request to a trained health staff member.`;

        case UserRole.HEALTH_WORKER:
            return `This question needs higher-level medical review. I will escalate this to a supervisor for further guidance.`;

        case UserRole.SUPERVISOR:
            return `This requires advanced clinical review. Escalating to an admin-level medical expert.`;

        default:
            return `This request will be escalated to a ${targetRoleName} for proper handling.`;
    }
}

/**
 * Get list of users with a specific role (for escalation routing)
 */
export async function getUsersWithRole(role: UserRole): Promise<Array<{ id: string; phone: string; name?: string }>> {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('users')
            .select('id, phone, name')
            .eq('role', role)
            .eq('status', 'active');

        if (error) {
            logger.error('Failed to get users with role', error, { role });
            return [];
        }

        return data || [];
    } catch (error) {
        logger.error('Error getting users with role', error as Error, { role });
        return [];
    }
}

/**
 * Initialize default role for a new user
 */
export async function initializeUserRole(userId: string, defaultRole: UserRole = UserRole.SUPPORT): Promise<void> {
    try {
        const supabase = getSupabaseClient();

        // Check if user already has a role
        const { data: existingUser } = await supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single();

        // Only set default role if user doesn't have one
        if (!existingUser?.role) {
            await setUserRole(userId, defaultRole);
            logger.info('Initialized default role for new user', { userId, defaultRole });
        }
    } catch (error) {
        logger.error('Error initializing user role', error as Error, { userId });
    }
}
