/**
 * Test script to verify the agent framework works
 * Run with: npx ts-node test-agent.ts
 */

import { ConversationHistory } from './src/agent/conversation-history';
import { ToolRegistry } from './src/agent/tools/tool-registry';
import { createKnowledgeSearchTool } from './src/agent/tools/knowledge-search-tool';
import { AgentLoop } from './src/agent/agent-loop';
import { config } from './src/config/env';

async function testAgent() {
    console.log('🤖 Testing Agent Framework\n');
    console.log('Configuration:');
    console.log(`- Agent Mode: ${config.agent.enabled}`);
    console.log(`- Max Iterations: ${config.agent.maxIterations}`);
    console.log(`- Conversation History Limit: ${config.agent.conversationHistoryLimit}\n`);

    // Initialize components
    const conversationHistory = new ConversationHistory(1000, config.agent.conversationHistoryLimit);
    const toolRegistry = new ToolRegistry();

    // Register tools
    const knowledgeSearchTool = createKnowledgeSearchTool();
    toolRegistry.registerTool(knowledgeSearchTool);

    console.log(`✅ Registered ${toolRegistry.getAllTools().length} tool(s)\n`);

    // Create agent loop
    const agentLoop = new AgentLoop(
        conversationHistory,
        toolRegistry,
        config.agent.maxIterations
    );

    console.log('🧪 Running test conversations...\n');

    // Test 1: Simple greeting (no tools)
    console.log('Test 1: Simple greeting');
    console.log('User: Hello, how are you?');
    try {
        const response1 = await agentLoop.run('test-chat-1', 'Hello, how are you?');
        console.log(`Agent: ${response1.response}`);
        console.log(`Stats: ${response1.iterations} iterations, ${response1.toolCallsCount} tool calls\n`);
    } catch (error) {
        console.error('Error:', (error as Error).message, '\n');
    }

    // Test 2: Knowledge search
    console.log('Test 2: Knowledge search');
    console.log('User: What are the symptoms of malaria?');
    try {
        const response2 = await agentLoop.run('test-chat-2', 'What are the symptoms of malaria?');
        console.log(`Agent: ${response2.response.substring(0, 200)}...`);
        console.log(`Stats: ${response2.iterations} iterations, ${response2.toolCallsCount} tool calls\n`);
    } catch (error) {
        console.error('Error:', (error as Error).message, '\n');
    }

    // Test 3: Conversation context
    console.log('Test 3: Conversation context');
    console.log('User: What is cholera?');
    try {
        const response3a = await agentLoop.run('test-chat-3', 'What is cholera?');
        console.log(`Agent: ${response3a.response.substring(0, 150)}...`);
        console.log(`Stats: ${response3a.iterations} iterations, ${response3a.toolCallsCount} tool calls\n`);

        console.log('User: How do I prevent it?');
        const response3b = await agentLoop.run('test-chat-3', 'How do I prevent it?');
        console.log(`Agent: ${response3b.response.substring(0, 150)}...`);
        console.log(`Stats: ${response3b.iterations} iterations, ${response3b.toolCallsCount} tool calls\n`);
    } catch (error) {
        console.error('Error:', (error as Error).message, '\n');
    }

    console.log('✅ Agent framework test complete!');
}

// Run the test
testAgent().catch(console.error);
