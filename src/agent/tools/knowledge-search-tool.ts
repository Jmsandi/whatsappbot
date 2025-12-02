import { Tool } from './tool-registry';
import { GenelineClient } from '../../geneline/client';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * Knowledge Search Tool
 * Searches the Geneline-X knowledge base for specific information
 */
export const createKnowledgeSearchTool = (): Tool => {
    const genelineClient = new GenelineClient();

    return {
        name: 'search_knowledge',
        description: 'Search the Sierra Leone public health knowledge base for specific information about diseases, treatments, prevention, healthcare facilities, and other health topics',
        parameters: [
            {
                name: 'query',
                type: 'string',
                description: 'The search query to find relevant information in the knowledge base',
                required: true,
            },
        ],
        execute: async (params: { query: string }): Promise<string> => {
            try {
                if (!params.query || typeof params.query !== 'string') {
                    return 'Error: Query parameter is required and must be a string';
                }

                logger.info('Executing knowledge search', {
                    query: params.query,
                });

                // Build a request to Geneline-X for knowledge retrieval
                // We use a special email to indicate this is a tool call
                const request = {
                    chatbotId: config.geneline.chatbotId,
                    email: 'agent-tool@geneline.local',
                    message: params.query,
                    systemPrompt: 'You are a knowledge base assistant. Provide accurate, concise information from the knowledge base to answer the query. Focus on facts and specific details.',
                };

                // Query Geneline-X
                const response = await genelineClient.sendMessage(request);

                logger.info('Knowledge search completed', {
                    query: params.query,
                    responseLength: response.length,
                });

                // Return the knowledge base response
                return response;

            } catch (error) {
                logger.error('Knowledge search failed', error as Error, {
                    query: params.query,
                });
                return `Error searching knowledge base: ${(error as Error).message}`;
            }
        },
    };
};
