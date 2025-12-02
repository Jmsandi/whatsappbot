import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import pdfParse from 'pdf-parse';
import { logger } from './logger';
import { FileMetadata } from '../geneline/ingest-types';

export class FileProcessor {
    private maxFileSizeMB: number;

    constructor(maxFileSizeMB: number = 50) {
        this.maxFileSizeMB = maxFileSizeMB;
    }

    /**
     * Validate and process a file for ingestion
     */
    async processFile(filePath: string): Promise<{
        buffer: Buffer;
        metadata: FileMetadata;
    }> {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Get file stats
        const stats = fs.statSync(filePath);
        const filename = path.basename(filePath);
        const mimeType = mime.lookup(filePath) || 'application/octet-stream';

        // Validate file size
        const fileSizeMB = stats.size / (1024 * 1024);
        if (fileSizeMB > this.maxFileSizeMB) {
            throw new Error(
                `File size (${fileSizeMB.toFixed(2)}MB) exceeds maximum allowed size (${this.maxFileSizeMB}MB)`
            );
        }

        logger.info('Processing file', {
            filename,
            size: stats.size,
            sizeMB: fileSizeMB.toFixed(2),
            mimeType,
        });

        // Read file buffer
        const buffer = fs.readFileSync(filePath);

        // Extract metadata based on file type
        const metadata: FileMetadata = {
            filename,
            size: stats.size,
            mimeType,
        };

        // If PDF, extract additional metadata
        if (mimeType === 'application/pdf') {
            try {
                const pdfData = await pdfParse(buffer);
                metadata.pages = pdfData.numpages;
                metadata.extractedText = pdfData.text.substring(0, 1000); // First 1000 chars for preview

                logger.info('PDF metadata extracted', {
                    filename,
                    pages: pdfData.numpages,
                    textLength: pdfData.text.length,
                });
            } catch (error) {
                logger.warn('Failed to extract PDF metadata', error as Error, {
                    filename,
                });
            }
        }

        return { buffer, metadata };
    }

    /**
     * Validate file type
     */
    validateFileType(filePath: string, allowedTypes: string[] = ['application/pdf']): boolean {
        const mimeType = mime.lookup(filePath);
        if (!mimeType) {
            return false;
        }
        return allowedTypes.includes(mimeType);
    }

    /**
     * Format file size for display
     */
    static formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Get file extension
     */
    static getFileExtension(filename: string): string {
        return path.extname(filename).toLowerCase();
    }

    /**
     * Validate file path
     */
    static validateFilePath(filePath: string): { valid: boolean; error?: string } {
        if (!filePath) {
            return { valid: false, error: 'File path is required' };
        }

        if (!fs.existsSync(filePath)) {
            return { valid: false, error: `File not found: ${filePath}` };
        }

        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            return { valid: false, error: `Path is not a file: ${filePath}` };
        }

        return { valid: true };
    }
}
