import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import {
    IngestFileRequest,
    IngestUrlRequest,
    IngestJobResponse,
    IngestJobStatus,
    IngestJobListResponse,
} from './ingest-types';

export class IngestClient {
    private client: AxiosInstance;
    private maxRetries = 3;
    private baseDelay = 1000; // 1 second
    private pollInterval: number;

    constructor() {
        this.client = axios.create({
            baseURL: config.geneline.ingestHost || config.geneline.host,
            headers: {
                'X-API-Key': config.geneline.apiKey,
            },
            timeout: 120000, // 2 minute timeout for file uploads
        });
        this.pollInterval = config.geneline.ingestPollIntervalMs || 5000;
    }

    /**
     * Upload a file directly to Geneline-X for ingestion
     */
    async ingestFile(request: IngestFileRequest): Promise<IngestJobResponse> {
        return this.ingestFileWithRetry(request, 0);
    }

    private async ingestFileWithRetry(
        request: IngestFileRequest,
        attempt: number
    ): Promise<IngestJobResponse> {
        try {
            logger.info('Uploading file to Geneline-X', {
                filename: request.filename,
                size: request.file.length,
                mimeType: request.mimeType,
                attempt: attempt + 1,
            });

            const formData = new FormData();
            formData.append('file', request.file, {
                filename: request.filename,
                contentType: request.mimeType,
            });
            formData.append('chatbotId', request.chatbotId);

            if (request.metadata) {
                formData.append('metadata', JSON.stringify(request.metadata));
            }

            const response = await this.client.post<IngestJobResponse>(
                '/api/v1/files/upload',
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                    },
                }
            );

            logger.info('File upload initiated', {
                jobId: response.data.jobId,
                filename: request.filename,
            });

            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;

            if (this.shouldRetry(axiosError, attempt)) {
                const delay = this.calculateBackoff(attempt);
                logger.warn(`Retrying file upload after ${delay}ms`, {
                    attempt: attempt + 1,
                    maxRetries: this.maxRetries,
                    error: axiosError.message,
                    status: axiosError.response?.status,
                });

                await this.sleep(delay);
                return this.ingestFileWithRetry(request, attempt + 1);
            }

            // Extract safe error information
            const errorInfo = {
                message: axiosError.message,
                status: axiosError.response?.status,
                statusText: axiosError.response?.statusText,
                data: axiosError.response?.data,
            };

            logger.error('File upload failed', new Error(axiosError.message), errorInfo);

            throw new Error(`File upload error: ${axiosError.message}${axiosError.response?.status ? ` (HTTP ${axiosError.response.status})` : ''}`);
        }
    }

    /**
     * Ingest a file from a URL
     */
    async ingestUrl(request: IngestUrlRequest): Promise<IngestJobResponse> {
        return this.ingestUrlWithRetry(request, 0);
    }

    private async ingestUrlWithRetry(
        request: IngestUrlRequest,
        attempt: number
    ): Promise<IngestJobResponse> {
        try {
            logger.info('Initiating URL ingestion', {
                url: request.url,
                attempt: attempt + 1,
            });

            const response = await this.client.post<IngestJobResponse>(
                '/api/v1/files/ingest-urls',
                {
                    chatbotId: request.chatbotId,
                    urls: [request.url],
                    metadata: request.metadata,
                }
            );

            logger.info('URL ingestion initiated', {
                jobId: response.data.jobId,
                url: request.url,
            });

            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;

            if (this.shouldRetry(axiosError, attempt)) {
                const delay = this.calculateBackoff(attempt);
                logger.warn(`Retrying URL ingestion after ${delay}ms`, {
                    attempt: attempt + 1,
                    maxRetries: this.maxRetries,
                    error: axiosError.message,
                    status: axiosError.response?.status,
                });

                await this.sleep(delay);
                return this.ingestUrlWithRetry(request, attempt + 1);
            }

            // Extract safe error information
            const errorInfo = {
                message: axiosError.message,
                status: axiosError.response?.status,
                statusText: axiosError.response?.statusText,
                data: axiosError.response?.data,
            };

            logger.error('URL ingestion failed', new Error(axiosError.message), errorInfo);

            throw new Error(`URL ingestion error: ${axiosError.message}${axiosError.response?.status ? ` (HTTP ${axiosError.response.status})` : ''}`);
        }
    }

    /**
     * Get the status of an ingestion job
     */
    async getJobStatus(jobId: string): Promise<IngestJobStatus> {
        try {
            const response = await this.client.get<IngestJobStatus>(
                `/api/v1/jobs/${jobId}`
            );
            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            const errorInfo = {
                message: axiosError.message,
                status: axiosError.response?.status,
                statusText: axiosError.response?.statusText,
                data: axiosError.response?.data,
                jobId,
            };
            logger.error('Failed to get job status', new Error(axiosError.message), errorInfo);
            throw new Error(`Failed to get job status: ${axiosError.message}${axiosError.response?.status ? ` (HTTP ${axiosError.response.status})` : ''}`);
        }
    }

    /**
     * Poll job status until completion or failure
     */
    async waitForJobCompletion(
        jobId: string,
        onProgress?: (status: IngestJobStatus) => void
    ): Promise<IngestJobStatus> {
        logger.info('Polling job status', { jobId });

        while (true) {
            const status = await this.getJobStatus(jobId);

            if (onProgress) {
                onProgress(status);
            }

            if (status.status === 'completed') {
                logger.info('Job completed successfully', { jobId });
                return status;
            }

            if (status.status === 'failed') {
                logger.error('Job failed', new Error(status.error || 'Unknown error'), {
                    jobId,
                });
                throw new Error(`Job failed: ${status.error || 'Unknown error'}`);
            }

            // Wait before polling again
            await this.sleep(this.pollInterval);
        }
    }

    /**
     * List all ingestion jobs
     */
    async listJobs(): Promise<IngestJobListResponse> {
        try {
            const response = await this.client.get<IngestJobListResponse>(
                '/api/v1/jobs',
                {
                    params: {
                        chatbotId: config.geneline.chatbotId,
                    },
                }
            );
            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            const errorInfo = {
                message: axiosError.message,
                status: axiosError.response?.status,
                statusText: axiosError.response?.statusText,
                data: axiosError.response?.data,
            };
            logger.error('Failed to list jobs', new Error(axiosError.message), errorInfo);
            throw new Error(`Failed to list jobs: ${axiosError.message}${axiosError.response?.status ? ` (HTTP ${axiosError.response.status})` : ''}`);
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
}
