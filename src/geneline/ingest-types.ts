export interface IngestFileRequest {
    chatbotId: string;
    file: Buffer;
    filename: string;
    mimeType: string;
    metadata?: {
        title?: string;
        description?: string;
        category?: string;
        [key: string]: any;
    };
}

export interface IngestUrlRequest {
    chatbotId: string;
    url: string;
    metadata?: {
        title?: string;
        description?: string;
        category?: string;
        [key: string]: any;
    };
}

export interface IngestJobResponse {
    success: boolean;
    jobId: string;
    message: string;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface IngestJobStatus {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    message?: string;
    error?: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

export interface IngestJobListResponse {
    success: boolean;
    jobs: IngestJobStatus[];
    total: number;
}

export interface FileMetadata {
    filename: string;
    size: number;
    mimeType: string;
    pages?: number;
    extractedText?: string;
}

export interface IngestJsonRequest {
    chatbotId: string;
    jsonData: object | object[];
    title?: string;
    description?: string;
    category?: string;
    metadata?: {
        [key: string]: any;
    };
}

export interface IngestCsvRequest {
    chatbotId: string;
    csvPath: string;
    title?: string;
    description?: string;
    category?: string;
    metadata?: {
        [key: string]: any;
    };
}
