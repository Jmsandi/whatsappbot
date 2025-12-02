import { ToolRegistry } from './tools/tool-registry';
import { config } from '../config/env';

export class PromptBuilder {
    private toolRegistry: ToolRegistry;

    constructor(toolRegistry: ToolRegistry) {
        this.toolRegistry = toolRegistry;
    }

    /**
     * Build the complete prompt for the agent
     */
    buildPrompt(
        userMessage: string,
        conversationHistory: string,
        includeTools: boolean = true
    ): string {
        const systemInstructions = this.getSystemInstructions();
        const toolInstructions = includeTools ? this.getToolInstructions() : '';
        const toolDefinitions = includeTools ? this.toolRegistry.formatToolsForPrompt() : '';

        return `${systemInstructions}

${toolDefinitions}

${toolInstructions}

${conversationHistory}

User: ${userMessage}
Assistant:`;
    }

    /**
     * Build prompt for tool result feedback
     */
    buildToolResultPrompt(
        toolName: string,
        toolResult: string,
        conversationHistory: string
    ): string {
        return `${this.getSystemInstructions()}

${conversationHistory}

Tool Result (${toolName}):
${toolResult}

Now provide a natural, helpful response to the user based on this information. Do not use any more tools.
Assistant:`;
    }

    /**
     * Get system instructions
     */
    private getSystemInstructions(): string {
        return `SYSTEM: You are a public health assistant for Sierra Leone with access to a knowledge base and tools.

Your role is to:
- Answer questions about public health topics in Sierra Leone
- Use available tools when you need specific information from the knowledge base
- Provide accurate, helpful, and compassionate responses
- Stay focused on public health topics

If a user asks about topics unrelated to public health in Sierra Leone, politely explain that you can only assist with public health questions about Sierra Leone.`;
    }

    /**
     * Get tool usage instructions
     */
    private getToolInstructions(): string {
        return `TOOL USAGE INSTRUCTIONS:
When you need to use a tool, respond with ONLY a JSON object in this exact format:
{
  "thought": "Brief explanation of why you're using this tool",
  "tool": "tool_name",
  "parameters": {
    "param_name": "param_value"
  }
}

After receiving tool results, provide a natural, conversational response to the user.

IMPORTANT:
- Use tools when you need specific information from the knowledge base
- For simple greetings or general questions, respond directly without tools
- Only output the JSON when calling a tool, nothing else
- After tool results, respond naturally in plain text`;
    }
}
