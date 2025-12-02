import { logger } from '../../utils/logger';

export interface ToolParameter {
    name: string;
    type: string;
    description: string;
    required: boolean;
}

export interface Tool {
    name: string;
    description: string;
    parameters: ToolParameter[];
    execute: (params: any) => Promise<string>;
}

export interface ToolCall {
    thought?: string;
    tool: string;
    parameters: Record<string, any>;
}

export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    /**
     * Register a tool
     */
    registerTool(tool: Tool): void {
        this.tools.set(tool.name, tool);
        logger.info('Tool registered', {
            name: tool.name,
            description: tool.description,
        });
    }

    /**
     * Get all registered tools
     */
    getAllTools(): Tool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get tool by name
     */
    getTool(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    /**
     * Execute a tool call
     */
    async executeTool(toolCall: ToolCall): Promise<string> {
        const tool = this.tools.get(toolCall.tool);

        if (!tool) {
            const error = `Tool not found: ${toolCall.tool}`;
            logger.error(error);
            return `Error: ${error}`;
        }

        try {
            logger.info('Executing tool', {
                tool: toolCall.tool,
                parameters: toolCall.parameters,
                thought: toolCall.thought,
            });

            const result = await tool.execute(toolCall.parameters);

            logger.info('Tool executed successfully', {
                tool: toolCall.tool,
                resultLength: result.length,
            });

            return result;

        } catch (error) {
            const errorMessage = `Tool execution failed: ${(error as Error).message}`;
            logger.error('Tool execution error', error as Error, {
                tool: toolCall.tool,
            });
            return `Error: ${errorMessage}`;
        }
    }

    /**
     * Format tools for prompt
     */
    formatToolsForPrompt(): string {
        const tools = this.getAllTools();

        if (tools.length === 0) {
            return '';
        }

        const toolDescriptions = tools.map((tool, index) => {
            const params = tool.parameters.map(p =>
                `${p.name}: ${p.type}${p.required ? ' (required)' : ' (optional)'} - ${p.description}`
            ).join(', ');

            return `${index + 1}. ${tool.name}(${params}) - ${tool.description}`;
        }).join('\n');

        return `\nAVAILABLE TOOLS:\n${toolDescriptions}\n`;
    }

    /**
     * Parse tool call from LLM response
     */
    parseToolCall(response: string): ToolCall | null {
        try {
            // Look for JSON in the response
            const jsonMatch = response.match(/\{[\s\S]*"tool"[\s\S]*\}/);

            if (!jsonMatch) {
                return null;
            }

            const parsed = JSON.parse(jsonMatch[0]);

            if (!parsed.tool) {
                return null;
            }

            return {
                thought: parsed.thought,
                tool: parsed.tool,
                parameters: parsed.parameters || {},
            };

        } catch (error) {
            logger.debug('Failed to parse tool call from response', {
                error: (error as Error).message,
            });
            return null;
        }
    }
}
