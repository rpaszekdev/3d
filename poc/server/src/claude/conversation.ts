import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { TOOL_DEFINITIONS } from './tool-definitions.js';
import { executeTool, type ToolCallLog } from './tool-executor.js';

const MAX_ITERATIONS = 5;
const MODEL = 'claude-sonnet-4-20250514';

interface ConversationResult {
  updatedMatrix: number[][];
  aiMessage: string;
  toolCalls: ToolCallLog[];
}

/**
 * Multi-turn tool-use conversation loop.
 * Claude receives the canvas state as SSL, can call tools up to MAX_ITERATIONS times,
 * and eventually produces a text response + modified matrix.
 */
export async function runConversation(
  client: Anthropic,
  ssl: string,
  matrix: number[][],
  userMessage: string,
): Promise<ConversationResult> {
  let currentMatrix = matrix.map(row => [...row]);
  const toolCallLog: ToolCallLog[] = [];

  // Build initial messages: user provides SSL canvas state + their question
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Current canvas state in SSL notation:\n\`\`\`\n${ssl || '(empty canvas)'}\n\`\`\`\n\nUser request: ${userMessage}`,
    },
  ];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    // Collect text blocks and tool use blocks
    const textParts: string[] = [];
    const toolUseBlocks: Anthropic.ContentBlockParam[] = [];
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else if (block.type === 'tool_use') {
        // Execute the tool
        const { result, matrix: newMatrix } = executeTool(
          block.name,
          block.input as Record<string, unknown>,
          currentMatrix,
        );

        currentMatrix = newMatrix;

        // Log for protocol transparency
        toolCallLog.push({
          name: block.name,
          input: block.input as Record<string, unknown>,
          result,
        });

        // Prepare assistant content block and tool result
        toolUseBlocks.push({
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    // If no tool calls, we're done — return final text
    if (toolUseBlocks.length === 0) {
      return {
        updatedMatrix: currentMatrix,
        aiMessage: textParts.join('\n'),
        toolCalls: toolCallLog,
      };
    }

    // Add assistant's response (with tool_use blocks) and tool results to messages
    messages.push({
      role: 'assistant',
      content: [...textParts.map(t => ({ type: 'text' as const, text: t })), ...toolUseBlocks],
    });

    messages.push({
      role: 'user',
      content: toolResults,
    });

    // If stop_reason is 'end_turn', the model is done even if it made tool calls
    if (response.stop_reason === 'end_turn' && toolUseBlocks.length > 0) {
      return {
        updatedMatrix: currentMatrix,
        aiMessage: textParts.join('\n'),
        toolCalls: toolCallLog,
      };
    }
  }

  // Hit max iterations
  return {
    updatedMatrix: currentMatrix,
    aiMessage: '[Reached maximum tool-use iterations]',
    toolCalls: toolCallLog,
  };
}
