import { GenelineClient } from '../geneline/client';
import { ConversationHistory, Message } from './conversation-history';
import { ToolRegistry, ToolCall } from './tools/tool-registry';
import { PromptBuilder } from './prompt-builder';
import { logger } from '../utils/logger';
import { config } from '../config/env';

export interface AgentResponse {
    response: string;
    toolCallsCount: number;
    iterations: number;
}

export class AgentLoop {
    private genelineClient: GenelineClient;
    private conversationHistory: ConversationHistory;
    private toolRegistry: ToolRegistry;
    private promptBuilder: PromptBuilder;
    private maxIterations: number;

    constructor(
        conversationHistory: ConversationHistory,
        toolRegistry: ToolRegistry,
        maxIterations: number = 5
    ) {
        this.genelineClient = new GenelineClient();
        this.conversationHistory = conversationHistory;
        this.toolRegistry = toolRegistry;
        this.promptBuilder = new PromptBuilder(toolRegistry);
        this.maxIterations = maxIterations;
    }

    /**
     * Run the agent loop for a user message
     */
    async run(chatId: string, userMessage: string): Promise<AgentResponse> {
        logger.info('Agent loop started', {
            chatId,
            messageLength: userMessage.length,
        });

        // Add user message to history
        this.conversationHistory.addMessage(chatId, {
            role: 'user',
            content: userMessage,
            timestamp: Date.now(),
        });

        let iterations = 0;
        let toolCallsCount = 0;

        while (iterations < this.maxIterations) {
            iterations++;

            logger.debug('Agent iteration', {
                chatId,
                iteration: iterations,
                maxIterations: this.maxIterations,
            });

            // Build prompt with conversation history
            const conversationHistoryText = this.conversationHistory.formatForPrompt(chatId);
            const prompt = this.promptBuilder.buildPrompt(
                userMessage,
                conversationHistoryText,
                true // include tools
            );

            // Send to Geneline-X
            const response = await this.callGeneline(chatId, prompt);

            // Check if response contains a tool call
            const toolCall = this.toolRegistry.parseToolCall(response);

            if (!toolCall) {
                // No tool call, this is the final response
                logger.info('Agent loop completed (final response)', {
                    chatId,
                    iterations,
                    toolCallsCount,
                    responseLength: response.length,
                });

                // Add assistant response to history
                this.conversationHistory.addMessage(chatId, {
                    role: 'assistant',
                    content: response,
                    timestamp: Date.now(),
                });

                return {
                    response,
                    toolCallsCount,
                    iterations,
                };
            }

            // Tool call detected
            toolCallsCount++;
            logger.info('Tool call detected', {
                chatId,
                tool: toolCall.tool,
                thought: toolCall.thought,
            });

            // Add tool call to history
            this.conversationHistory.addMessage(chatId, {
                role: 'assistant',
                content: JSON.stringify(toolCall),
                timestamp: Date.now(),
            });

            // Execute tool
            const toolResult = await this.toolRegistry.executeTool(toolCall);

            // Add tool result to history
            this.conversationHistory.addMessage(chatId, {
                role: 'tool',
                content: toolResult,
                toolName: toolCall.tool,
                timestamp: Date.now(),
            });

            // Build prompt with tool result
            const historyWithToolResult = this.conversationHistory.formatForPrompt(chatId);
            const toolResultPrompt = this.promptBuilder.buildToolResultPrompt(
                toolCall.tool,
                toolResult,
                historyWithToolResult
            );

            // Get final response after tool execution
            const finalResponse = await this.callGeneline(chatId, toolResultPrompt);

            // Add final response to history
            this.conversationHistory.addMessage(chatId, {
                role: 'assistant',
                content: finalResponse,
                timestamp: Date.now(),
            });

            logger.info('Agent loop completed (after tool execution)', {
                chatId,
                iterations,
                toolCallsCount,
                responseLength: finalResponse.length,
            });

            return {
                response: finalResponse,
                toolCallsCount,
                iterations,
            };
        }

        // Max iterations reached
        logger.warn('Agent loop max iterations reached', {
            chatId,
            maxIterations: this.maxIterations,
        });

        const fallbackResponse = "I apologize, but I'm having trouble processing your request. Please try rephrasing your question.";

        this.conversationHistory.addMessage(chatId, {
            role: 'assistant',
            content: fallbackResponse,
            timestamp: Date.now(),
        });

        return {
            response: fallbackResponse,
            toolCallsCount,
            iterations,
        };
    }

    /**
     * Call Geneline-X with a prompt
     */
    private async callGeneline(chatId: string, prompt: string): Promise<string> {
        const request = {
            chatbotId: config.geneline.chatbotId,
            email: `agent+${chatId.replace(/[^a-zA-Z0-9]/g, '')}@geneline.local`,
            message: prompt,
        };

        return await this.genelineClient.sendMessage(request);
    }
}
