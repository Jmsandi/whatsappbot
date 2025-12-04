import { ToolRegistry } from './tools/tool-registry';
import { config } from '../config/env';

export class PromptBuilder {
    private toolRegistry: ToolRegistry;

    constructor(toolRegistry: ToolRegistry) {
        this.toolRegistry = toolRegistry;
    }

    /**
     * Build the complete prompt for the agent with role-based instructions
     */
    buildPrompt(
        userMessage: string,
        conversationHistory: string,
        includeTools: boolean = true,
        userRole?: string
    ): string {
        const systemInstructions = this.getSystemInstructions(userRole);
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
        conversationHistory: string,
        userRole?: string
    ): string {
        return `${this.getSystemInstructions(userRole)}

${conversationHistory}

Tool Result (${toolName}):
${toolResult}

Now provide a natural, helpful response to the user based on this information. Do not use any more tools.
Assistant:`;
    }

    /**
     * Get system instructions based on user role
     */
    private getSystemInstructions(userRole?: string): string {
        // Import role prompts dynamically to avoid circular dependencies
        const { getRolePrompt } = require('./role-prompts');
        const { UserRole, parseRole } = require('../types/role-types');

        // Parse and validate role
        const role = parseRole(userRole, UserRole.SUPPORT);

        // Get role-specific prompt
        return getRolePrompt(role);
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
