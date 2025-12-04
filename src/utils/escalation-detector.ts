import { getSupabaseClient } from '../config/supabase';
import { logger } from './logger';
import { escalationConfig, detectEscalationKeywords, getEscalationPriority, getEscalationResponse } from '../config/escalation-config';

interface EscalationData {
    userId: string;
    messageId: string;
    reason: string;
    triggerType: string;
    priority: string;
    messageContent: string;
}

interface EscalationCheck {
    shouldEscalate: boolean;
    reason?: string;
    triggerType?: string;
    priority?: string;
    response?: string;
}

/**
 * Check if a message should be escalated based on various triggers
 * Now supports role-based escalation with health-specific keywords
 */
export async function checkForEscalation(
    messageContent: string,
    confidenceScore?: number,
    intent?: string,
    userRole?: string
): Promise<EscalationCheck> {

    // 1. Check for emergency keywords (highest priority)
    const keywordCheck = detectEscalationKeywords(messageContent);
    if (keywordCheck.triggered && keywordCheck.category === 'emergency') {
        return {
            shouldEscalate: true,
            reason: `Emergency detected: ${keywordCheck.matchedKeywords.join(', ')}`,
            triggerType: 'emergency',
            priority: 'urgent',
            response: getEscalationResponse('emergency')
        };
    }

    // 2. Check for safety keywords (mental health, violence, etc.)
    if (keywordCheck.triggered && keywordCheck.category === 'safety') {
        return {
            shouldEscalate: true,
            reason: `Safety concern detected: ${keywordCheck.matchedKeywords.join(', ')}`,
            triggerType: 'safety',
            priority: 'urgent',
            response: getEscalationResponse('safety')
        };
    }

    // 3. Check for clinical complexity keywords
    if (keywordCheck.triggered && keywordCheck.category === 'clinicalComplexity') {
        return {
            shouldEscalate: true,
            reason: `Clinical complexity detected: ${keywordCheck.matchedKeywords.join(', ')}`,
            triggerType: 'clinical_complexity',
            priority: getEscalationPriority('clinicalComplexity'),
            response: getEscalationResponse('clinicalComplexity')
        };
    }

    // 4. Check for policy/system keywords
    if (keywordCheck.triggered && keywordCheck.category === 'policySystem') {
        return {
            shouldEscalate: true,
            reason: `Policy/system question detected: ${keywordCheck.matchedKeywords.join(', ')}`,
            triggerType: 'policy_system',
            priority: getEscalationPriority('policySystem'),
            response: getEscalationResponse('policySystem')
        };
    }

    // DISABLED: Symptom keyword escalation - causes false positives
    // Example: "what is malaria" triggers escalation even though it's just educational
    // Let the AI determine if escalation is needed based on context instead
    /*
    // 5. Check for symptom keywords (escalate if user is support staff)
    if (keywordCheck.triggered && keywordCheck.category === 'symptoms') {
        // Only escalate symptoms if user is support staff
        if (userRole === 'support') {
            return {
                shouldEscalate: true,
                reason: `Symptom question from support staff: ${keywordCheck.matchedKeywords.join(', ')}`,
                triggerType: 'role_limitation',
                priority: getEscalationPriority('symptoms'),
                response: getEscalationResponse('symptoms')
            };
        }
    }
    */

    // 6. Check for user request keywords
    if (keywordCheck.triggered && keywordCheck.category === 'userRequest') {
        return {
            shouldEscalate: true,
            reason: `User requested human assistance: ${keywordCheck.matchedKeywords.join(', ')}`,
            triggerType: 'user_request',
            priority: getEscalationPriority('userRequest'),
            response: getEscalationResponse('userRequest')
        };
    }

    // 7. Check for urgency keywords
    if (keywordCheck.triggered && keywordCheck.category === 'urgency') {
        return {
            shouldEscalate: true,
            reason: `Urgent request detected: ${keywordCheck.matchedKeywords.join(', ')}`,
            triggerType: 'keyword',
            priority: getEscalationPriority('urgency'),
            response: getEscalationResponse('urgency')
        };
    }

    // 8. Check for complaint/frustration keywords
    if (keywordCheck.triggered && (keywordCheck.category === 'complaint' || keywordCheck.category === 'frustration')) {
        return {
            shouldEscalate: true,
            reason: `User dissatisfaction detected: ${keywordCheck.matchedKeywords.join(', ')}`,
            triggerType: 'keyword',
            priority: getEscalationPriority(keywordCheck.category),
            response: getEscalationResponse('escalated')
        };
    }

    // DISABLED: Automatic escalation based on confidence and intent
    // These were causing too many false positives - every message was being escalated

    /*
    // 9. Check confidence score
    if (confidenceScore !== undefined && confidenceScore < escalationConfig.confidenceThreshold) {
        return {
            shouldEscalate: true,
            reason: `Low AI confidence: ${(confidenceScore * 100).toFixed(1)}%`,
            triggerType: 'low_confidence',
            priority: 'normal',
            response: getEscalationResponse('escalated')
        };
    }

    // 10. Check for unrecognized intent
    if (!intent || intent === 'unknown' || intent === 'unrecognized') {
        return {
            shouldEscalate: true,
            reason: 'Unrecognized user intent',
            triggerType: 'failed_intent',
            priority: 'normal',
            response: getEscalationResponse('escalated')
        };
    }
    */

    return {
        shouldEscalate: false
    };
}

/**
 * Create an escalation record in the database
 */
export async function createEscalation(data: EscalationData): Promise<string | null> {
    try {
        const supabase = getSupabaseClient();

        const { data: escalation, error } = await supabase
            .from('escalations')
            .insert({
                user_id: data.userId,
                message_id: data.messageId,
                reason: data.reason,
                trigger_type: data.triggerType,
                priority: data.priority,
                status: 'pending'
            })
            .select('id')
            .single();

        if (error) {
            logger.error('Failed to create escalation', error);
            return null;
        }

        // Update the message to mark it as escalated
        await supabase
            .from('messages')
            .update({
                is_escalated: true,
                escalation_id: escalation.id
            })
            .eq('id', data.messageId);

        logger.info('Escalation created', {
            escalationId: escalation.id,
            userId: data.userId,
            triggerType: data.triggerType,
            priority: data.priority
        });

        return escalation.id;
    } catch (error) {
        logger.error('Error creating escalation', error as Error);
        return null;
    }
}

/**
 * Get escalation by ID
 */
export async function getEscalation(escalationId: string) {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('escalations')
            .select('*, users(name, phone), messages(content, created_at)')
            .eq('id', escalationId)
            .single();

        if (error) {
            logger.error('Failed to get escalation', error);
            return null;
        }

        return data;
    } catch (error) {
        logger.error('Error getting escalation', error as Error);
        return null;
    }
}

/**
 * Update escalation status
 */
export async function updateEscalationStatus(
    escalationId: string,
    status: string,
    adminName?: string,
    notes?: string
): Promise<boolean> {
    try {
        const supabase = getSupabaseClient();

        const updateData: any = {
            status,
            updated_at: new Date().toISOString()
        };

        if (adminName) {
            updateData.assigned_to = adminName;
        }

        if (notes) {
            updateData.admin_notes = notes;
        }

        if (status === 'resolved' || status === 'closed') {
            updateData.resolved_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('escalations')
            .update(updateData)
            .eq('id', escalationId);

        if (error) {
            logger.error('Failed to update escalation status', error);
            return false;
        }

        logger.info('Escalation status updated', {
            escalationId,
            status,
            adminName
        });

        return true;
    } catch (error) {
        logger.error('Error updating escalation status', error as Error);
        return false;
    }
}
