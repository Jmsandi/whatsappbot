import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import qrCodeTerminal from 'qrcode-terminal';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface WhatsAppClientState {
    isReady: boolean;
    qrCode?: string; // base64 PNG
    clientInfo?: {
        pushname: string;
        platform: string;
    };
}

export class WhatsAppClient extends EventEmitter {
    private client: Client;
    private state: WhatsAppClientState = {
        isReady: false,
    };

    constructor() {
        super();

        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: config.whatsapp.clientId,
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process', // Important for stability
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                ],
                timeout: 60000, // 60 second timeout
            },
        });

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        this.client.on('qr', async (qr) => {
            logger.info('QR code received, scan to authenticate');

            // Display in terminal
            qrCodeTerminal.generate(qr, { small: true });

            // Generate base64 PNG for API
            try {
                const qrCodeDataUrl = await QRCode.toDataURL(qr);
                this.state.qrCode = qrCodeDataUrl;
                this.emit('qr', qrCodeDataUrl);
            } catch (error) {
                logger.error('Failed to generate QR code', error as Error);
            }
        });

        this.client.on('ready', () => {
            logger.info('WhatsApp client is ready');
            this.state.isReady = true;
            this.state.qrCode = undefined;

            const info = this.client.info;
            if (info) {
                this.state.clientInfo = {
                    pushname: info.pushname,
                    platform: info.platform,
                };
            }

            this.emit('ready');
        });

        this.client.on('authenticated', () => {
            logger.info('WhatsApp client authenticated');
            this.emit('authenticated');
        });

        this.client.on('auth_failure', (msg) => {
            logger.error('WhatsApp authentication failed', new Error(msg));
            this.emit('auth_failure', msg);
        });

        this.client.on('disconnected', (reason) => {
            logger.warn('WhatsApp client disconnected', { reason });
            this.state.isReady = false;
            this.emit('disconnected', reason);
        });

        this.client.on('message', (message) => {
            this.emit('message', message);
        });
    }

    /**
     * Initialize and start the WhatsApp client
     */
    async initialize(): Promise<void> {
        logger.info('Initializing WhatsApp client...');
        await this.client.initialize();
    }

    /**
     * Get the current client state
     */
    getState(): WhatsAppClientState {
        return { ...this.state };
    }

    /**
     * Get the underlying whatsapp-web.js client
     */
    getClient(): Client {
        return this.client;
    }

    /**
     * Send a text message to a chat
     */
    async sendMessage(chatId: string, message: string): Promise<void> {
        if (!this.state.isReady) {
            throw new Error('WhatsApp client is not ready');
        }

        await this.client.sendMessage(chatId, message);
        logger.debug('Message sent', { chatId, messageLength: message.length });
    }

    /**
     * Send typing indicator to a chat
     */
    async sendTyping(chatId: string): Promise<void> {
        if (!this.state.isReady) {
            return;
        }

        const chat = await this.client.getChatById(chatId);
        await chat.sendStateTyping();
    }

    /**
     * Clear typing indicator
     */
    async clearTyping(chatId: string): Promise<void> {
        if (!this.state.isReady) {
            return;
        }

        const chat = await this.client.getChatById(chatId);
        await chat.clearState();
    }

    /**
     * Logout and clear session
     */
    async logout(): Promise<void> {
        logger.info('Logging out WhatsApp client');
        await this.client.logout();
        this.state.isReady = false;
        this.state.qrCode = undefined;
        this.state.clientInfo = undefined;
    }

    /**
     * Destroy the client
     */
    async destroy(): Promise<void> {
        logger.info('Destroying WhatsApp client');
        await this.client.destroy();
        this.state.isReady = false;
    }
}
