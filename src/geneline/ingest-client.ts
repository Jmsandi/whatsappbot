import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import {
    IngestFileRequest,
    IngestUrlRequest,
    IngestJsonRequest,
    IngestCsvRequest,
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
            formData.append('namespace', config.geneline.namespace || 'public_health_info');

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
                    namespace: config.geneline.namespace || 'public_health_info',
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

    /**
     * Ingest JSON data by converting it to markdown format
     */
    async ingestJson(request: IngestJsonRequest): Promise<IngestJobResponse> {
        try {
            logger.info('Converting JSON to markdown for ingestion', {
                title: request.title,
                isArray: Array.isArray(request.jsonData),
            });

            // Convert JSON to markdown
            const markdown = this.convertJsonToMarkdown(
                request.jsonData,
                request.title || 'Data Import',
                request.description
            );

            // Create buffer from markdown
            const buffer = Buffer.from(markdown, 'utf-8');
            const filename = `${request.title?.replace(/\s+/g, '_') || 'data'}.md`;

            // Upload as file
            return await this.ingestFile({
                chatbotId: request.chatbotId,
                file: buffer,
                filename,
                mimeType: 'text/markdown',
                metadata: {
                    title: request.title,
                    description: request.description,
                    category: request.category,
                    source: 'json_import',
                    recordCount: Array.isArray(request.jsonData)
                        ? request.jsonData.length
                        : 1,
                    ...request.metadata,
                },
            });
        } catch (error) {
            logger.error('JSON ingestion failed', error as Error);
            throw new Error(`JSON ingestion error: ${(error as Error).message}`);
        }
    }

    /**
     * Ingest CSV data by converting it to markdown format
     */
    async ingestCsv(request: IngestCsvRequest): Promise<IngestJobResponse> {
        try {
            const fs = await import('fs/promises');
            const { parse } = await import('csv-parse/sync');

            logger.info('Reading and converting CSV to markdown', {
                path: request.csvPath,
                title: request.title,
            });

            // Read CSV file
            const csvContent = await fs.readFile(request.csvPath, 'utf-8');

            // Parse CSV
            const records = parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });

            logger.info('CSV parsed successfully', {
                recordCount: records.length,
            });

            // Convert to markdown
            const markdown = this.convertJsonToMarkdown(
                records,
                request.title || 'CSV Import',
                request.description
            );

            // Create buffer from markdown
            const buffer = Buffer.from(markdown, 'utf-8');
            const filename = `${request.title?.replace(/\s+/g, '_') || 'data'}.md`;

            // Upload as file
            return await this.ingestFile({
                chatbotId: request.chatbotId,
                file: buffer,
                filename,
                mimeType: 'text/markdown',
                metadata: {
                    title: request.title,
                    description: request.description,
                    category: request.category,
                    source: 'csv_import',
                    recordCount: records.length,
                    ...request.metadata,
                },
            });
        } catch (error) {
            logger.error('CSV ingestion failed', error as Error);
            throw new Error(`CSV ingestion error: ${(error as Error).message}`);
        }
    }

    /**
     * Convert JSON data to markdown format
     */
    private convertJsonToMarkdown(
        data: object | object[],
        title: string,
        description?: string
    ): string {
        let markdown = `# ${title}\n\n`;

        if (description) {
            markdown += `${description}\n\n`;
        }

        markdown += '---\n\n';

        const records = Array.isArray(data) ? data : [data];

        records.forEach((record, index) => {
            markdown += `## Record ${index + 1}\n\n`;

            Object.entries(record).forEach(([key, value]) => {
                // Format the key to be more readable
                const formattedKey = key
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (l) => l.toUpperCase());

                // Format the value
                let formattedValue = value;
                if (value === null || value === undefined || value === '') {
                    formattedValue = 'N/A';
                } else if (typeof value === 'object') {
                    formattedValue = JSON.stringify(value);
                }

                markdown += `- **${formattedKey}**: ${formattedValue}\n`;
            });

            markdown += '\n';
        });

        return markdown;
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
