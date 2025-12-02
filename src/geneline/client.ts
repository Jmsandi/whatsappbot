import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { GenelineRequest, GenelineResponse } from './types';

export class GenelineClient {
    private client: AxiosInstance;
    private maxRetries = 3;
    private baseDelay = 1000; // 1 second

    constructor() {
        this.client = axios.create({
            baseURL: config.geneline.host,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': config.geneline.apiKey,
                // Alternative: 'Authorization': `Bearer ${config.geneline.apiKey}`,
            },
            timeout: 60000, // 60 second timeout
        });
    }

    /**
     * Send a message to Geneline-X AI
     * @param request The request payload
     * @returns The AI response text
     */
    async sendMessage(request: GenelineRequest): Promise<string> {
        return this.sendWithRetry(request, 0);
    }

    private async sendWithRetry(request: GenelineRequest, attempt: number): Promise<string> {
        try {
            logger.debug('Sending request to Geneline-X', {
                chatbotId: request.chatbotId,
                email: request.email,
                hasSystemPrompt: !!request.systemPrompt,
                systemPromptLength: request.systemPrompt?.length || 0,
                attempt: attempt + 1,
            });

            // Log the full request for debugging
            logger.debug('Full Geneline-X request payload', {
                request: JSON.stringify(request, null, 2),
            });

            const response = await this.client.post('/api/v1/message', request, {
                responseType: 'stream',
            });

            // Handle streaming response
            const chunks: string[] = [];

            return new Promise((resolve, reject) => {
                response.data.on('data', (chunk: Buffer) => {
                    chunks.push(chunk.toString());
                });

                response.data.on('end', () => {
                    const fullResponse = chunks.join('');
                    logger.debug('Received complete response from Geneline-X', {
                        responseLength: fullResponse.length,
                    });
                    resolve(fullResponse);
                });

                response.data.on('error', (error: Error) => {
                    logger.error('Stream error from Geneline-X', error);
                    reject(error);
                });
            });

        } catch (error) {
            const axiosError = error as AxiosError;

            // Check if we should retry
            if (this.shouldRetry(axiosError, attempt)) {
                const delay = this.calculateBackoff(attempt);
                logger.warn(`Retrying Geneline-X request after ${delay}ms`, {
                    attempt: attempt + 1,
                    maxRetries: this.maxRetries,
                    error: axiosError.message,
                });

                await this.sleep(delay);
                return this.sendWithRetry(request, attempt + 1);
            }

            // No more retries or non-retryable error
            logger.error('Geneline-X request failed', axiosError as Error, {
                attempt: attempt + 1,
                status: axiosError.response?.status,
            });

            throw new Error(`Geneline-X API error: ${axiosError.message}`);
        }
    }

    private shouldRetry(error: AxiosError, attempt: number): boolean {
        if (attempt >= this.maxRetries) {
            return false;
        }

        // Retry on network errors
        if (!error.response) {
            return true;
        }

        // Retry on 429 (rate limit) and 5xx (server errors)
        const status = error.response.status;
        return status === 429 || (status >= 500 && status < 600);
    }

    private calculateBackoff(attempt: number): number {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        return this.baseDelay * Math.pow(2, attempt);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Build a Geneline request from WhatsApp message data
     */
    static buildRequest(
        chatId: string,
        messageId: string,
        messageText: string,
        isGroup: boolean,
        userName?: string,
        mediaAttachments?: Array<{ filename: string; mime: string; data_base64: string }>
    ): GenelineRequest {
        // Use chatId as email identifier (sanitized)
        const email = `user+${chatId.replace(/[^a-zA-Z0-9]/g, '')}@geneline.local`;

        // Prepend system instructions to the message
        let enhancedMessage = messageText;
        if (config.geneline.systemPrompt) {
            enhancedMessage = `[SYSTEM INSTRUCTIONS: ${config.geneline.systemPrompt}]\n\nUser message: ${messageText}`;
        }

        return {
            chatbotId: config.geneline.chatbotId,
            email,
            message: enhancedMessage,
            metadata: {
                whatsappChatId: chatId,
                messageId,
                isGroup,
                userName,
                media: mediaAttachments,
            },
        };
    }
}
