import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { WhatsAppClient } from '../whatsapp/client';
import { QueueManager } from '../queue/manager';
import { IngestClient } from '../geneline/ingest-client';
import { FileProcessor } from '../utils/file-processor';
import { config } from '../config/env';
import { logger } from '../utils/logger';

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
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;

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
                cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: ${config.ingest.allowedFileTypes.join(', ')}`));
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

    return router;
}
