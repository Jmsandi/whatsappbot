import dotenv from 'dotenv';

dotenv.config();

interface Config {
    nodeEnv: string;
    port: number;
    geneline: {
        host: string;
        apiKey: string;
        chatbotId: string;
        systemPrompt?: string;
        ingestHost?: string;
        ingestPollIntervalMs: number;
        namespace?: string;
    };
    whatsapp: {
        clientId: string;
        allowGroupMessages: boolean;
    };
    admin: {
        apiKey: string;
    };
    queue: {
        maxConcurrency: number;
        perChatRateLimitMs: number;
    };
    ingest: {
        maxFileSizeMB: number;
        allowedFileTypes: string[];
    };
    agent: {
        enabled: boolean;
        maxIterations: number;
        conversationHistoryLimit: number;
    };
    supabase: {
        url: string;
        serviceRoleKey: string;
    };
}

function getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key] || defaultValue;
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    return value ? parseInt(value, 10) : defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    return value ? value.toLowerCase() === 'true' : defaultValue;
}

export const config: Config = {
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
    port: getEnvNumber('PORT', 3001),
    geneline: {
        host: getEnvVar('GENELINE_HOST'),
        apiKey: getEnvVar('GENELINE_API_KEY'),
        chatbotId: getEnvVar('GENELINE_CHATBOT_ID'),
        systemPrompt: getEnvVar('GENELINE_SYSTEM_PROMPT',
            'You are a public health assistant for Sierra Leone. You ONLY answer questions related to public health topics in Sierra Leone, including but not limited to: diseases (malaria, cholera, Ebola, etc.), vaccinations, healthcare facilities, maternal and child health, nutrition, sanitation, hygiene, disease prevention, and health services. If a user asks about topics unrelated to public health in Sierra Leone, politely explain that you can only assist with public health questions about Sierra Leone and encourage them to ask a relevant question.'
        ),
        ingestHost: process.env.GENELINE_INGEST_HOST,
        ingestPollIntervalMs: getEnvNumber('INGEST_POLL_INTERVAL_MS', 5000),
        namespace: process.env.GENELINE_NAMESPACE || 'public_health_info',
    },
    whatsapp: {
        clientId: getEnvVar('WHATSAPP_CLIENT_ID', 'main-bot'),
        allowGroupMessages: getEnvBoolean('ALLOW_GROUP_MESSAGES', false),
    },
    admin: {
        apiKey: getEnvVar('ADMIN_API_KEY'),
    },
    queue: {
        maxConcurrency: getEnvNumber('MAX_CONCURRENCY', 5),
        perChatRateLimitMs: getEnvNumber('PER_CHAT_RATE_LIMIT_MS', 1000),
    },
    ingest: {
        maxFileSizeMB: getEnvNumber('MAX_FILE_SIZE_MB', 50),
        allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'application/pdf').split(','),
    },
    agent: {
        enabled: getEnvBoolean('ENABLE_AGENT_MODE', false),
        maxIterations: getEnvNumber('AGENT_MAX_ITERATIONS', 5),
        conversationHistoryLimit: getEnvNumber('AGENT_CONVERSATION_HISTORY_LIMIT', 10),
    },
    supabase: {
        url: getEnvVar('SUPABASE_URL'),
        serviceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    },
};
