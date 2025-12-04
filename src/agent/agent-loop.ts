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
    shouldEscalate?: boolean;
    escalationReason?: string;
    confidence?: number;
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
    async run(chatId: string, userMessage: string, userRole?: string): Promise<AgentResponse> {
        logger.info('Agent loop started', {
            chatId,
            messageLength: userMessage.length,
            userRole,
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

            // Build prompt with conversation history and user role
            const conversationHistoryText = this.conversationHistory.formatForPrompt(chatId);
            const prompt = this.promptBuilder.buildPrompt(
                userMessage,
                conversationHistoryText,
                true, // include tools
                userRole
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

                // Check if escalation is needed
                const escalationCheck = await this.checkForEscalation(
                    chatId,
                    userMessage,
                    response,
                    iterations,
                    userRole
                );

                return {
                    response,
                    toolCallsCount,
                    iterations,
                    ...escalationCheck
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
                historyWithToolResult,
                userRole
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

    /**
     * Check if the conversation should be escalated to a human
     */
    private async checkForEscalation(
        chatId: string,
        userMessage: string,
        aiResponse: string,
        iterations: number,
        userRole?: string
    ): Promise<{ shouldEscalate?: boolean; escalationReason?: string; confidence?: number }> {
        try {
            // Import escalation detector
            const { checkForEscalation } = await import('../utils/escalation-detector');

            // Check user message for escalation keywords with role context
            // Only check for CRITICAL keywords: emergency, safety, explicit user requests
            const userEscalation = await checkForEscalation(userMessage, undefined, undefined, userRole);
            if (userEscalation.shouldEscalate) {
                logger.info('Escalation triggered by critical keywords', {
                    chatId,
                    userRole,
                    reason: userEscalation.reason,
                    triggerType: userEscalation.triggerType
                });
                return {
                    shouldEscalate: true,
                    escalationReason: userEscalation.reason,
                    confidence: 0
                };
            }

            // NEW: Check if AI response indicates escalation is needed
            // AI will include "[ESCALATE: reason]" in response if human intervention needed
            const escalationMarker = aiResponse.match(/\[ESCALATE:\s*([^\]]+)\]/i);
            if (escalationMarker) {
                const reason = escalationMarker[1].trim();
                logger.info('AI-determined escalation needed', {
                    chatId,
                    userRole,
                    reason
                });
                return {
                    shouldEscalate: true,
                    escalationReason: `AI assessment: ${reason}`,
                    confidence: 0.8
                };
            }

            // DISABLED: Automatic escalation based on AI uncertainty
            // These were causing too many false positives

            /*
            // Analyze AI response for uncertainty indicators
            const uncertaintyIndicators = [
                "I'm not sure",
                "I don't know",
                "I cannot",
                "I'm unable to",
                "I don't have information",
                "I apologize, but I",
                "I'm having trouble",
                "I don't understand",
                "unclear",
                "uncertain"
            ];

            const lowerResponse = aiResponse.toLowerCase();
            const hasUncertainty = uncertaintyIndicators.some(indicator =>
                lowerResponse.includes(indicator.toLowerCase())
            );

            // Calculate confidence based on response characteristics
            let confidence = 1.0;

            if (hasUncertainty) {
                confidence -= 0.4;
            }

            if (iterations >= this.maxIterations - 1) {
                confidence -= 0.3;
            }

            if (aiResponse.length < 50) {
                confidence -= 0.2;
            }

            // Check for repeated similar responses (user frustration)
            const recentHistory = this.conversationHistory.getRecentMessages(chatId, 6);
            const userMessages = recentHistory.filter((m: Message) => m.role === 'user');

            if (userMessages.length >= 3) {
                const lastThreeMessages = userMessages.slice(-3).map((m: Message) => m.content.toLowerCase());
                const areSimilar = this.areMessagesSimilar(lastThreeMessages);

                if (areSimilar) {
                    logger.info('User frustration detected (repeated questions)', { chatId });
                    return {
                        shouldEscalate: true,
                        escalationReason: 'User repeating similar questions - possible frustration',
                        confidence: 0.3
                    };
                }
            }

            // Escalate if confidence is too low
            if (confidence < 0.5) {
                logger.info('Low confidence response detected', {
                    chatId,
                    confidence,
                    hasUncertainty,
                    iterations
                });
                return {
                    shouldEscalate: true,
                    escalationReason: `Low AI confidence (${(confidence * 100).toFixed(0)}%) - uncertain response`,
                    confidence
                };
            }
            */

            return {
                shouldEscalate: false,
                confidence: 1.0
            };
        } catch (error) {
            logger.error('Error checking for escalation', error as Error);
            return {
                shouldEscalate: false,
                confidence: 0.5
            };
        }
    }

    /**
     * Check if messages are similar (user repeating question)
     */
    private areMessagesSimilar(messages: string[]): boolean {
        if (messages.length < 2) return false;

        // Simple similarity check based on word overlap
        const getWords = (text: string) => text.toLowerCase().split(/\s+/).filter(w => w.length > 3);

        for (let i = 0; i < messages.length - 1; i++) {
            const words1 = new Set(getWords(messages[i]));
            const words2 = new Set(getWords(messages[i + 1]));

            const intersection = new Set([...words1].filter(w => words2.has(w)));
            const union = new Set([...words1, ...words2]);

            const similarity = intersection.size / union.size;

            if (similarity > 0.6) {
                return true;
            }
        }

        return false;
    }
}
