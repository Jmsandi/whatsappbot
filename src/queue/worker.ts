import { GenelineClient } from '../geneline/client';
import { logger, logEvent } from '../utils/logger';
import { QueuedMessage } from './manager';
import { config } from '../config/env';
import { AgentLoop } from '../agent/agent-loop';
import { ConversationHistory } from '../agent/conversation-history';
import { ToolRegistry } from '../agent/tools/tool-registry';
import { createKnowledgeSearchTool } from '../agent/tools/knowledge-search-tool';

export class MessageWorker {
    private genelineClient: GenelineClient;
    private agentLoop: AgentLoop | null = null;
    private conversationHistory: ConversationHistory | null = null;

    constructor() {
        this.genelineClient = new GenelineClient();

        // Initialize agent if enabled
        if (config.agent.enabled) {
            this.initializeAgent();
        }
    }

    /**
     * Initialize the agent framework
     */
    private initializeAgent(): void {
        try {
            logger.info('Initializing agent framework');

            // Create conversation history manager
            this.conversationHistory = new ConversationHistory(
                1000, // max chats
                config.agent.conversationHistoryLimit
            );

            // Create tool registry
            const toolRegistry = new ToolRegistry();

            // Register tools
            const knowledgeSearchTool = createKnowledgeSearchTool();
            toolRegistry.registerTool(knowledgeSearchTool);

            // Register web search tool for current information
            const { createWebSearchTool } = require('../agent/tools/web-search-tool');
            const webSearchTool = createWebSearchTool();
            toolRegistry.registerTool(webSearchTool);

            // Create agent loop
            this.agentLoop = new AgentLoop(
                this.conversationHistory,
                toolRegistry,
                config.agent.maxIterations
            );

            logger.info('Agent framework initialized successfully', {
                maxIterations: config.agent.maxIterations,
                conversationHistoryLimit: config.agent.conversationHistoryLimit,
                registeredTools: toolRegistry.getAllTools().length,
            });

        } catch (error) {
            logger.error('Failed to initialize agent framework', error as Error);
            // Fall back to direct mode
            this.agentLoop = null;
            this.conversationHistory = null;
        }
    }

    /**
     * Process a queued message
     */
    async processMessage(message: QueuedMessage): Promise<void> {
        const { chatId, messageId, messageText, isGroup, userName, mediaAttachments } = message;

        try {
            logEvent.incomingMessage(chatId, messageId, !!mediaAttachments?.length);

            // Use agent mode if enabled and initialized
            if (config.agent.enabled && this.agentLoop) {
                return this.processWithAgent(chatId, messageId, messageText);
            } else {
                return this.processDirectly(chatId, messageId, messageText, isGroup, userName, mediaAttachments);
            }

        } catch (error) {
            logEvent.error('Failed to process message', error as Error, {
                chatId,
                messageId,
            });

            // Send fallback message
            return this.sendFallbackMessage(chatId);
        }
    }

    /**
     * Process message using agent framework
     */
    private async processWithAgent(chatId: string, messageId: string, messageText: string): Promise<void> {
        logger.info('Processing message with agent', { chatId, messageId });

        // Get user role for role-based prompting
        const phone = chatId.split('@')[0];
        const { getUserRoleByPhone } = await import('../utils/role-manager');
        const userRole = await getUserRoleByPhone(phone);

        logger.debug('User role retrieved for agent processing', { chatId, userRole });

        const agentResponse = await this.agentLoop!.run(chatId, messageText, userRole);

        logger.info('Agent processing completed', {
            chatId,
            messageId,
            userRole,
            iterations: agentResponse.iterations,
            toolCallsCount: agentResponse.toolCallsCount,
            responseLength: agentResponse.response.length,
            shouldEscalate: agentResponse.shouldEscalate,
            confidence: agentResponse.confidence
        });

        // Handle escalation if needed
        if (agentResponse.shouldEscalate) {
            await this.handleEscalation(chatId, messageId, messageText, agentResponse, userRole);
        }

        // Send response
        return this.sendResponse(chatId, messageId, agentResponse.response);
    }

    /**
     * Process message directly (legacy mode)
     */
    private async processDirectly(
        chatId: string,
        messageId: string,
        messageText: string,
        isGroup: boolean,
        userName?: string,
        mediaAttachments?: Array<{ filename: string; mime: string; data_base64: string }>
    ): Promise<void> {
        logger.info('Processing message directly (legacy mode)', { chatId, messageId });

        // Build Geneline request
        const request = GenelineClient.buildRequest(
            chatId,
            messageId,
            messageText,
            isGroup,
            userName,
            mediaAttachments
        );

        logEvent.aiRequestSent(chatId, messageId);

        // Call Geneline-X API
        const aiResponse = await this.genelineClient.sendMessage(request);

        logEvent.aiResponseReceived(chatId, messageId, aiResponse.length);

        // Return the response (will be sent by WhatsApp handler)
        return this.sendResponse(chatId, messageId, aiResponse);
    }

    /**
     * Send AI response back to WhatsApp
     * This will be overridden to use the actual WhatsApp client
     */
    private async sendResponse(chatId: string, messageId: string, response: string): Promise<void> {
        // Placeholder - will be set by the main app
        logger.debug('Sending response to WhatsApp', {
            chatId,
            messageId,
            responseLength: response.length,
        });
    }

    /**
     * Send fallback message on error
     */
    private async sendFallbackMessage(chatId: string): Promise<void> {
        logger.debug('Sending fallback message', { chatId });
    }

    /**
     * Set the response sender function (injected from WhatsApp client)
     */
    setResponseSender(sender: (chatId: string, messageId: string, response: string) => Promise<void>): void {
        this.sendResponse = sender;
    }

    /**
     * Set the fallback message sender function
     */
    setFallbackSender(sender: (chatId: string) => Promise<void>): void {
        this.sendFallbackMessage = sender;
    }

    /**
     * Handle escalation when agent determines human intervention is needed
     */
    private async handleEscalation(
        chatId: string,
        messageId: string,
        messageText: string,
        agentResponse: { shouldEscalate?: boolean; escalationReason?: string; confidence?: number },
        userRole?: string
    ): Promise<void> {
        try {
            logger.info('Creating escalation from agent detection', {
                chatId,
                messageId,
                userRole,
                reason: agentResponse.escalationReason,
                confidence: agentResponse.confidence
            });

            // Get user ID from phone number
            const phone = chatId.split('@')[0];
            const { getUserIdByPhone } = await import('../utils/database-sync');
            const userId = await getUserIdByPhone(phone);

            if (!userId) {
                logger.error('Cannot create escalation: user not found', { phone });
                return;
            }

            // Get message ID from database
            const { getSupabaseClient } = await import('../config/supabase');
            const supabase = getSupabaseClient();

            const { data: dbMessage } = await supabase
                .from('messages')
                .select('id')
                .eq('user_id', userId)
                .eq('content', messageText)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!dbMessage) {
                logger.error('Cannot create escalation: message not found in database');
                return;
            }

            // Create escalation
            const { createEscalation } = await import('../utils/escalation-detector');

            const escalationId = await createEscalation({
                userId,
                messageId: dbMessage.id,
                reason: agentResponse.escalationReason || 'Agent detected need for human assistance',
                triggerType: agentResponse.confidence !== undefined && agentResponse.confidence < 0.5 ? 'low_confidence' : 'failed_intent',
                priority: agentResponse.confidence !== undefined && agentResponse.confidence < 0.3 ? 'high' : 'normal',
                messageContent: messageText
            });

            if (escalationId) {
                logger.info('Escalation created successfully', {
                    escalationId,
                    userId,
                    messageId: dbMessage.id,
                    userRole
                });

                // Get role-based escalation message
                const { getEscalationMessage } = await import('../utils/role-manager');
                const { parseRole } = await import('../types/role-types');
                const role = parseRole(userRole);

                const acknowledgment = getEscalationMessage(role, agentResponse.escalationReason || 'escalation');
                await this.sendResponse(chatId, messageId, acknowledgment);
            }
        } catch (error) {
            logger.error('Failed to handle escalation', error as Error);
        }
    }
}
