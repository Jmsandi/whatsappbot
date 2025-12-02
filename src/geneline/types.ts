export interface GenelineRequest {
    chatbotId: string;
    email: string;
    message: string;
    systemPrompt?: string; // Optional system instructions for the AI
    metadata?: {
        whatsappChatId: string;
        messageId: string;
        isGroup: boolean;
        userName?: string;
        media?: MediaAttachment[];
        [key: string]: any;
    };
}

export interface MediaAttachment {
    filename: string;
    mime: string;
    data_base64: string;
}

export interface GenelineResponse {
    success: boolean;
    message: string;
    data?: any;
}
