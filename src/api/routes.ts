import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { WhatsAppClient } from '../whatsapp/client';
import { QueueManager } from '../queue/manager';
import { IngestClient } from '../geneline/ingest-client';
import { FileProcessor } from '../utils/file-processor';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/supabase';
import contentGenerationRoutes from './routes/content-generation';

interface AdminRouterDeps {
    whatsappClient: WhatsAppClient;
    queueManager: QueueManager;
}

/**
 * Middleware to verify admin API key
 */
function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey || apiKey !== config.admin.apiKey) {
        res.status(401).json({
            success: false,
            error: 'Unauthorized',
        });
        return;
    }

    next();
}

export function createAdminRouter(deps: AdminRouterDeps): Router {
    const router = Router();
    const { whatsappClient, queueManager } = deps;

    /**
     * GET /health - Health check
     */
    router.get('/health', (req: Request, res: Response) => {
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
        });
    });

    // Mount content generation routes
    router.use('/admin', contentGenerationRoutes);

    /**
     * GET /qr - Get QR code for pairing
     */
    router.get('/qr', (req: Request, res: Response) => {
        const state = whatsappClient.getState();

        if (state.isReady) {
            res.json({
                success: true,
                message: 'Client is already authenticated',
                isReady: true,
            });
            return;
        }

        if (!state.qrCode) {
            res.json({
                success: false,
                message: 'QR code not yet available. Please wait...',
                isReady: false,
            });
            return;
        }

        res.json({
            success: true,
            qrCode: state.qrCode, // base64 data URL
            isReady: false,
        });
    });

    /**
     * GET /status - Get bot status and metrics
     */
    router.get('/status', (req: Request, res: Response) => {
        const state = whatsappClient.getState();
        const queueStats = queueManager.getStats();

        res.json({
            success: true,
            whatsapp: {
                isReady: state.isReady,
                clientInfo: state.clientInfo,
            },
            queue: queueStats,
            timestamp: new Date().toISOString(),
        });
    });

    /**
     * POST /send - Send arbitrary message (admin only)
     */
    router.post('/send', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const { phone, message } = req.body;

            if (!phone || !message) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: phone, message',
                });
                return;
            }

            // Format phone number to WhatsApp chat ID
            const chatId = phone.includes('@') ? phone : `${phone} @c.us`;

            await whatsappClient.sendMessage(chatId, message);

            logger.info('Admin message sent', { chatId });

            res.json({
                success: true,
                message: 'Message sent successfully',
                chatId,
            });

        } catch (error) {
            logger.error('Failed to send admin message', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * POST /session/clear - Clear WhatsApp session (admin only)
     */
    router.post('/session/clear', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            await whatsappClient.logout();

            logger.info('WhatsApp session cleared by admin');

            res.json({
                success: true,
                message: 'Session cleared successfully. Please restart the service to re-authenticate.',
            });

        } catch (error) {
            logger.error('Failed to clear session', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * GET /queue/stats - Get queue statistics (admin only)
     */
    router.get('/queue/stats', requireAdminAuth, (req: Request, res: Response) => {
        const stats = queueManager.getStats();

        res.json({
            success: true,
            stats,
        });
    });

    /**
     * POST /queue/clear - Clear all queues (admin only)
     */
    router.post('/queue/clear', requireAdminAuth, (req: Request, res: Response) => {
        queueManager.clearAll();

        logger.info('All queues cleared by admin');

        res.json({
            success: true,
            message: 'All queues cleared',
        });
    });

    // Configure multer for file uploads
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: config.ingest.maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
        },
        fileFilter: (req, file, cb) => {
            if (config.ingest.allowedFileTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error(`File type ${file.mimetype} not allowed.Allowed types: ${config.ingest.allowedFileTypes.join(', ')} `));
            }
        },
    });

    /**
     * POST /admin/ingest/file - Upload a file for ingestion (admin only)
     */
    router.post('/admin/ingest/file', requireAdminAuth, upload.single('file'), async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                res.status(400).json({
                    success: false,
                    error: 'No file uploaded',
                });
                return;
            }

            const { title, description, category } = req.body;

            logger.info('Admin file upload initiated', {
                filename: req.file.originalname,
                size: req.file.size,
                mimeType: req.file.mimetype,
            });

            const ingestClient = new IngestClient();
            const response = await ingestClient.ingestFile({
                chatbotId: config.geneline.chatbotId,
                file: req.file.buffer,
                filename: req.file.originalname,
                mimeType: req.file.mimetype,
                metadata: {
                    title,
                    description,
                    category,
                },
            });

            res.json(response);

        } catch (error) {
            logger.error('File upload failed', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * POST /admin/ingest/url - Ingest from URL (admin only)
     */
    router.post('/admin/ingest/url', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const { url, title, description, category } = req.body;

            if (!url) {
                res.status(400).json({
                    success: false,
                    error: 'URL is required',
                });
                return;
            }

            logger.info('Admin URL ingestion initiated', { url });

            const ingestClient = new IngestClient();
            const response = await ingestClient.ingestUrl({
                chatbotId: config.geneline.chatbotId,
                url,
                metadata: {
                    title,
                    description,
                    category,
                },
            });

            res.json(response);

        } catch (error) {
            logger.error('URL ingestion failed', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * GET /admin/ingest/status/:jobId - Get job status (admin only)
     */
    router.get('/admin/ingest/status/:jobId', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const { jobId } = req.params;

            const ingestClient = new IngestClient();
            const status = await ingestClient.getJobStatus(jobId);

            res.json({
                success: true,
                status,
            });

        } catch (error) {
            logger.error('Failed to get job status', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * GET /admin/ingest/jobs - List all jobs (admin only)
     */
    router.get('/admin/ingest/jobs', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const ingestClient = new IngestClient();
            const jobs = await ingestClient.listJobs();

            res.json(jobs);

        } catch (error) {
            logger.error('Failed to list jobs', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    // =============================================
    // ANALYTICS ENDPOINTS
    // =============================================

    /**
     * GET /api/analytics/stats - Get dashboard statistics
     */
    router.get('/api/analytics/stats', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [totalUsersResult, activeUsersResult, totalMessagesResult, todayMessagesResult] = await Promise.all([
                supabase.from('users').select('*', { count: 'exact', head: true }),
                supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'active'),
                supabase.from('messages').select('*', { count: 'exact', head: true }),
                supabase.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
            ]);

            res.json({
                success: true,
                stats: {
                    totalUsers: totalUsersResult.count || 0,
                    activeUsers: activeUsersResult.count || 0,
                    totalMessages: totalMessagesResult.count || 0,
                    todayMessages: todayMessagesResult.count || 0,
                },
            });
        } catch (error) {
            logger.error('Failed to get analytics stats', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * GET /api/analytics/intents/distribution - Get intent distribution
     */
    router.get('/api/analytics/intents/distribution', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('intents')
                .select('name, qa_count')
                .order('qa_count', { ascending: false })
                .limit(10);

            if (error) throw error;

            res.json({
                success: true,
                intents: data.map((intent) => ({
                    intent: intent.name,
                    count: intent.qa_count,
                })),
            });
        } catch (error) {
            logger.error('Failed to get intent distribution', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    // =============================================
    // USER MANAGEMENT ENDPOINTS
    // =============================================

    /**
     * GET /api/users - List all users
     */
    router.get('/api/users', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const { status, search, limit = 100, offset = 0 } = req.query;

            let query = supabase.from('users').select('*');

            if (status && status !== 'all') {
                query = query.eq('status', status as string);
            }

            if (search) {
                query = query.or(`phone.ilike.% ${search}%, name.ilike.% ${search}% `);
            }

            query = query.order('created_at', { ascending: false })
                .range(Number(offset), Number(offset) + Number(limit) - 1);

            const { data, error, count } = await query;

            if (error) throw error;

            res.json({
                success: true,
                users: data,
                total: count,
            });
        } catch (error) {
            logger.error('Failed to list users', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * GET /api/users/:id - Get user details
     */
    router.get('/api/users/:id', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const { id } = req.params;

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            res.json({
                success: true,
                user: data,
            });
        } catch (error) {
            logger.error('Failed to get user', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * PUT /api/users/:id - Update user
     */
    router.put('/api/users/:id', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const { id } = req.params;
            const { status, tags, name } = req.body;

            const updateData: any = {};
            if (status) updateData.status = status;
            if (tags) updateData.tags = tags;
            if (name) updateData.name = name;
            updateData.updated_at = new Date().toISOString();

            const { data, error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            res.json({
                success: true,
                user: data,
            });
        } catch (error) {
            logger.error('Failed to update user', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * GET /api/users/:id/messages - Get user conversation history
     */
    router.get('/api/users/:id/messages', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const { id } = req.params;
            const { limit = 50 } = req.query;

            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('user_id', id)
                .order('created_at', { ascending: false })
                .limit(Number(limit));

            if (error) throw error;

            res.json({
                success: true,
                messages: data,
            });
        } catch (error) {
            logger.error('Failed to get user messages', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    // =============================================
    // MESSAGE ENDPOINTS
    // =============================================

    /**
     * GET /api/messages - List all messages
     */
    router.get('/api/messages', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const { limit = 100, offset = 0, sender, search } = req.query;

            let query = supabase.from('messages').select('*, users(phone, name)', { count: 'exact' });

            if (sender && sender !== 'all') {
                query = query.eq('sender', sender as string);
            }

            if (search) {
                query = query.ilike('content', `% ${search}% `);
            }

            query = query.order('created_at', { ascending: false })
                .range(Number(offset), Number(offset) + Number(limit) - 1);

            const { data, error, count } = await query;

            if (error) throw error;

            res.json({
                success: true,
                messages: data,
                total: count,
            });
        } catch (error) {
            logger.error('Failed to list messages', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    // =============================================
    // BROADCAST ENDPOINTS
    // =============================================

    /**
     * POST /api/broadcast - Send broadcast message
     */
    router.post('/api/broadcast', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const { message, target = 'All Users', title } = req.body;

            if (!message || !title) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: title, message',
                });
                return;
            }

            const supabase = getSupabaseClient();

            // Get target users
            let query = supabase.from('users').select('phone');

            if (target === 'Active Users') {
                query = query.eq('status', 'active');
            } else if (target === 'VIP Only') {
                query = query.contains('tags', ['VIP']);
            }

            const { data: users, error: usersError } = await query;
            if (usersError) throw usersError;

            if (!users || users.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'No users found for target audience',
                });
                return;
            }

            // Store broadcast in database
            const { data: broadcast, error: broadcastError } = await supabase
                .from('broadcasts')
                .insert({
                    title,
                    message,
                    target,
                    target_count: users.length,
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    created_by: 'Admin',
                })
                .select()
                .single();

            if (broadcastError) throw broadcastError;

            // Send messages to all users
            let deliveredCount = 0;
            for (const user of users) {
                try {
                    const chatId = `${user.phone} @c.us`;
                    await whatsappClient.sendMessage(chatId, message);
                    deliveredCount++;
                } catch (error) {
                    logger.error('Failed to send broadcast to user', error as Error, { phone: user.phone });
                }
            }

            // Update broadcast with delivery count
            await supabase
                .from('broadcasts')
                .update({ delivered_count: deliveredCount })
                .eq('id', broadcast.id);

            res.json({
                success: true,
                broadcast: {
                    ...broadcast,
                    delivered_count: deliveredCount,
                },
            });
        } catch (error) {
            logger.error('Failed to send broadcast', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * GET /api/broadcast/history - Get broadcast history
     */
    router.get('/api/broadcast/history', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const { limit = 50 } = req.query;

            const { data, error } = await supabase
                .from('broadcasts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(Number(limit));

            if (error) throw error;

            res.json({
                success: true,
                broadcasts: data,
            });
        } catch (error) {
            logger.error('Failed to get broadcast history', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    // =============================================
    // SETTINGS ENDPOINTS
    // =============================================

    /**
     * GET /api/settings - Get bot settings
     */
    router.get('/api/settings', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('bot_settings')
                .select('key, value');

            if (error) throw error;

            const settings: Record<string, string> = {};
            data?.forEach((setting) => {
                if (setting.value) {
                    settings[setting.key] = setting.value;
                }
            });

            res.json({
                success: true,
                settings,
            });
        } catch (error) {
            logger.error('Failed to get settings', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * PUT /api/settings - Update bot settings
     */
    router.put('/api/settings', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const { settings } = req.body;

            if (!settings || typeof settings !== 'object') {
                res.status(400).json({
                    success: false,
                    error: 'Invalid settings format',
                });
                return;
            }

            // Update each setting
            for (const [key, value] of Object.entries(settings)) {
                await supabase
                    .from('bot_settings')
                    .upsert({
                        key,
                        value: String(value),
                        updated_by: 'Admin',
                        updated_at: new Date().toISOString(),
                    }, {
                        onConflict: 'key',
                    });
            }

            res.json({
                success: true,
                message: 'Settings updated successfully',
            });
        } catch (error) {
            logger.error('Failed to update settings', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    // =============================================
    // CONTACTS ENDPOINTS
    // =============================================

    /**
     * GET /api/contacts - Get special contacts
     */
    router.get('/api/contacts', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('special_contacts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            res.json({
                success: true,
                contacts: data,
            });
        } catch (error) {
            logger.error('Failed to get contacts', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * POST /api/contacts - Add special contact
     */
    router.post('/api/contacts', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const { name, phone, email, role } = req.body;

            if (!name || !phone || !role) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: name, phone, role',
                });
                return;
            }

            const { data, error } = await supabase
                .from('special_contacts')
                .insert({ name, phone, email, role, status: 'active' })
                .select()
                .single();

            if (error) throw error;

            res.json({
                success: true,
                contact: data,
            });
        } catch (error) {
            logger.error('Failed to add contact', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * PUT /api/contacts/:id - Update contact
     */
    router.put('/api/contacts/:id', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const { id } = req.params;
            const { name, phone, email, role, status } = req.body;

            const updateData: any = { updated_at: new Date().toISOString() };
            if (name) updateData.name = name;
            if (phone) updateData.phone = phone;
            if (email !== undefined) updateData.email = email;
            if (role) updateData.role = role;
            if (status) updateData.status = status;

            const { data, error } = await supabase
                .from('special_contacts')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            res.json({
                success: true,
                contact: data,
            });
        } catch (error) {
            logger.error('Failed to update contact', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * DELETE /api/contacts/:id - Delete contact
     */
    router.delete('/api/contacts/:id', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();
            const { id } = req.params;

            const { error } = await supabase
                .from('special_contacts')
                .delete()
                .eq('id', id);

            if (error) throw error;

            res.json({
                success: true,
                message: 'Contact deleted successfully',
            });
        } catch (error) {
            logger.error('Failed to delete contact', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    // =============================================
    // ROLE MANAGEMENT ENDPOINTS
    // =============================================

    /**
     * GET /api/users/:id/role - Get user's role
     */
    router.get('/api/users/:id/role', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const { getUserRole } = await import('../utils/role-manager');
            const { id } = req.params;

            const role = await getUserRole(id);

            res.json({
                success: true,
                role,
            });
        } catch (error) {
            logger.error('Failed to get user role', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * PUT /api/users/:id/role - Update user's role (admin only)
     */
    router.put('/api/users/:id/role', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            const { setUserRole } = await import('../utils/role-manager');
            const { isValidRole } = await import('../types/role-types');
            const { id } = req.params;
            const { role } = req.body;

            if (!role || !isValidRole(role)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid role. Must be one of: support, health_worker, supervisor, admin',
                });
                return;
            }

            const success = await setUserRole(id, role);

            if (!success) {
                res.status(500).json({
                    success: false,
                    error: 'Failed to update user role',
                });
                return;
            }

            res.json({
                success: true,
                message: 'User role updated successfully',
                role,
            });
        } catch (error) {
            logger.error('Failed to update user role', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * GET /api/roles - Get all available roles and their descriptions
     */
    router.get('/api/roles', requireAdminAuth, (req: Request, res: Response) => {
        try {
            const { ROLE_DISPLAY_NAMES, ROLE_DESCRIPTIONS, UserRole } = require('../types/role-types');

            const roles = (Object.values(UserRole) as string[]).map((role) => ({
                value: role,
                label: ROLE_DISPLAY_NAMES[role as keyof typeof ROLE_DISPLAY_NAMES],
                description: ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS],
            }));

            res.json({
                success: true,
                roles,
            });
        } catch (error) {
            logger.error('Failed to get roles', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    /**
     * POST /admin/trigger-broadcast - Manually trigger a health awareness broadcast
     */
    router.post('/admin/trigger-broadcast', requireAdminAuth, async (req: Request, res: Response) => {
        try {
            logger.info('Manual broadcast triggered by admin');

            // Import and run broadcast function
            const { checkAndSendBroadcasts } = await import('../scheduler/broadcast-scheduler');

            // Force send by temporarily setting next_broadcast_at to now
            const supabase = getSupabaseClient();
            const { data: settings } = await supabase
                .from('broadcast_settings')
                .select('*')
                .single();

            if (!settings) {
                res.status(404).json({
                    success: false,
                    error: 'Broadcast settings not found'
                });
                return;
            }

            // Temporarily set next broadcast to now to trigger send
            await supabase
                .from('broadcast_settings')
                .update({ next_broadcast_at: new Date().toISOString() })
                .eq('id', settings.id);

            // Trigger broadcast
            await checkAndSendBroadcasts(whatsappClient);

            res.json({
                success: true,
                message: 'Broadcast triggered successfully'
            });

        } catch (error) {
            logger.error('Failed to trigger manual broadcast', error as Error);
            res.status(500).json({
                success: false,
                error: (error as Error).message
            });
        }
    });

    return router;
}
