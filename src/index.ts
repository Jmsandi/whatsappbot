import { WhatsAppClient } from './whatsapp/client';
import { MessageHandler } from './whatsapp/handlers';
import { QueueManager } from './queue/manager';
import { MessageWorker } from './queue/worker';
import { ApiServer } from './api/server';
import { createAdminRouter } from './api/routes';
import { logger } from './utils/logger';
import { config } from './config/env';

class Application {
    private whatsappClient: WhatsAppClient;
    private queueManager: QueueManager;
    private messageWorker: MessageWorker;
    private messageHandler: MessageHandler;
    private apiServer: ApiServer;

    constructor() {
        logger.info('Initializing WhatsApp-Geneline Bridge...');

        // Initialize components
        this.whatsappClient = new WhatsAppClient();
        this.queueManager = new QueueManager();
        this.messageWorker = new MessageWorker();
        this.messageHandler = new MessageHandler(this.whatsappClient, this.queueManager);
        this.apiServer = new ApiServer();

        // Wire up dependencies
        this.setupDependencies();
    }

    private setupDependencies(): void {
        // Set message processor for queue
        this.queueManager.setProcessor(async (message) => {
            await this.messageWorker.processMessage(message);
        });

        // Set response senders for worker
        this.messageWorker.setResponseSender(async (chatId, messageId, response) => {
            await this.messageHandler.sendResponse(chatId, messageId, response);
        });

        this.messageWorker.setFallbackSender(async (chatId) => {
            await this.messageHandler.sendFallback(chatId);
        });

        // Setup WhatsApp message handler
        this.whatsappClient.on('message', async (message) => {
            await this.messageHandler.handleMessage(message);
        });

        // Setup API routes
        const router = createAdminRouter({
            whatsappClient: this.whatsappClient,
            queueManager: this.queueManager,
        });

        this.apiServer.getApp().use('/', router);
        this.apiServer.setupErrorHandling();
    }

    async start(): Promise<void> {
        try {
            logger.info('Starting application...');

            // Start API server
            await this.apiServer.start();
            logger.info(`API server started on port ${config.port}`);

            // Initialize WhatsApp client
            await this.whatsappClient.initialize();
            logger.info('WhatsApp client initialized');

            logger.info('Application started successfully');
            logger.info(`Environment: ${config.nodeEnv}`);
            logger.info(`Geneline-X Host: ${config.geneline.host}`);
            logger.info(`Max Concurrency: ${config.queue.maxConcurrency}`);
            logger.info(`Per-Chat Rate Limit: ${config.queue.perChatRateLimitMs}ms`);
            logger.info(`Allow Group Messages: ${config.whatsapp.allowGroupMessages}`);

        } catch (error) {
            logger.error('Failed to start application', error as Error);
            process.exit(1);
        }
    }

    async stop(): Promise<void> {
        logger.info('Stopping application...');

        try {
            // Stop API server
            await this.apiServer.stop();

            // Destroy WhatsApp client
            await this.whatsappClient.destroy();

            logger.info('Application stopped successfully');
        } catch (error) {
            logger.error('Error during shutdown', error as Error);
        }
    }
}

// Create and start application
const app = new Application();

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal');
    await app.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal');
    await app.stop();
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', new Error(String(reason)), {
        promise: String(promise),
    });
});

// Start the application
app.start().catch((error) => {
    logger.error('Fatal error during startup', error);
    process.exit(1);
});
