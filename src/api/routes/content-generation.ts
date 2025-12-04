import { Router, Request, Response } from 'express';
import { AIContentGenerator } from '../../services/ai-content-generator';
import { logger } from '../../utils/logger';
import { getSupabaseClient } from '../../config/supabase';

const router = Router();
const aiGenerator = new AIContentGenerator();

/**
 * POST /api/admin/generate-topic
 * Trigger AI health topic generation
 */
router.post('/generate-topic', async (req: Request, res: Response) => {
    try {
        const { category, seasonalFocus } = req.body;

        logger.info('Admin triggered AI topic generation', { category, seasonalFocus });

        const result = await aiGenerator.generateAndSave({
            category,
            seasonalFocus
        });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Failed to generate topic'
            });
        }

        return res.json({
            success: true,
            topicId: result.topicId,
            topic: result.topic
        });
    } catch (error) {
        logger.error('Error in generate-topic endpoint', error as Error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /api/admin/pending-topics
 * Get topics pending review
 */
router.get('/pending-topics', async (req: Request, res: Response) => {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('health_topics')
            .select('*')
            .eq('status', 'pending_review')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            topics: data || []
        });
    } catch (error) {
        logger.error('Error getting pending topics', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to get pending topics'
        });
    }
});

/**
 * POST /api/admin/approve-topic/:id
 * Approve and publish a topic
 */
router.post('/approve-topic/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reviewedBy } = req.body;

        const supabase = getSupabaseClient();

        const { data, error } = await supabase.rpc('approve_health_topic', {
            p_topic_id: id,
            p_reviewed_by: reviewedBy || 'admin'
        });

        if (error) {
            throw error;
        }

        logger.info('Topic approved', { topicId: id, reviewedBy });

        res.json({
            success: true,
            topic: data
        });
    } catch (error) {
        logger.error('Error approving topic', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve topic'
        });
    }
});

/**
 * POST /api/admin/reject-topic/:id
 * Reject a topic
 */
router.post('/reject-topic/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reviewedBy, reason } = req.body;

        const supabase = getSupabaseClient();

        const { data, error } = await supabase.rpc('reject_health_topic', {
            p_topic_id: id,
            p_reviewed_by: reviewedBy || 'admin',
            p_rejection_reason: reason
        });

        if (error) {
            throw error;
        }

        logger.info('Topic rejected', { topicId: id, reviewedBy, reason });

        res.json({
            success: true,
            topic: data
        });
    } catch (error) {
        logger.error('Error rejecting topic', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject topic'
        });
    }
});

/**
 * PUT /api/admin/settings/auto-publish
 * Update auto-publish settings
 */
router.put('/settings/auto-publish', async (req: Request, res: Response) => {
    try {
        const { enabled, frequency } = req.body;

        const supabase = getSupabaseClient();

        const { data, error } = await supabase.rpc('update_system_setting', {
            p_setting_key: 'health_topics_auto_publish',
            p_setting_value: { enabled, frequency, last_generated: null },
            p_updated_by: 'admin'
        });

        if (error) {
            throw error;
        }

        logger.info('Auto-publish settings updated', { enabled, frequency });

        res.json({
            success: true,
            settings: data
        });
    } catch (error) {
        logger.error('Error updating auto-publish settings', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to update settings'
        });
    }
});

/**
 * GET /api/admin/settings
 * Get all system settings
 */
router.get('/settings', async (req: Request, res: Response) => {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('system_settings')
            .select('*');

        if (error) {
            throw error;
        }

        // Convert to key-value object
        const settings: Record<string, any> = {};
        data?.forEach(setting => {
            settings[setting.setting_key] = setting.setting_value;
        });

        res.json({
            success: true,
            settings
        });
    } catch (error) {
        logger.error('Error getting settings', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to get settings'
        });
    }
});

export default router;
