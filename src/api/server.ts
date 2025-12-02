import express, { Express, Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export class ApiServer {
    private app: Express;
    private server?: any;

    constructor() {
        this.app = express();
        this.setupMiddleware();
    }

    private setupMiddleware(): void {
        // Body parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            logger.debug('Incoming request', {
                method: req.method,
                path: req.path,
                ip: req.ip,
            });
            next();
        });
    }

    /**
     * Get the Express app instance
     */
    getApp(): Express {
        return this.app;
    }

    /**
     * Start the server
     */
    async start(): Promise<void> {
        return new Promise((resolve) => {
            this.server = this.app.listen(config.port, () => {
                logger.info(`API server listening on port ${config.port}`);
                resolve();
            });
        });
    }

    /**
     * Stop the server
     */
    async stop(): Promise<void> {
        if (!this.server) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.server.close((err: Error) => {
                if (err) {
                    logger.error('Error stopping server', err);
                    reject(err);
                } else {
                    logger.info('API server stopped');
                    resolve();
                }
            });
        });
    }

    /**
     * Setup error handling
     */
    setupErrorHandling(): void {
        // 404 handler
        this.app.use((req: Request, res: Response) => {
            res.status(404).json({
                success: false,
                error: 'Not found',
            });
        });

        // Error handler
        this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            logger.error('Unhandled error', err, {
                method: req.method,
                path: req.path,
            });

            res.status(500).json({
                success: false,
                error: config.nodeEnv === 'production'
                    ? 'Internal server error'
                    : err.message,
            });
        });
    }
}
