import { type LanguageModelMiddleware } from 'ai';

// DeepSeek's API is stricter than OpenAI's about tool-call message ordering:
// 1. Every assistant message with tool_calls MUST be immediately followed by
//    tool messages for ALL of its tool_call_ids (no gaps, no missing results).
// 2. DeepSeek rejects "duplicate" tool_call_id when the same id appears in
//    both the historical messages AND a new tool_calls array.
//
// Fix: reorder messages so tool results always directly follow their
// corresponding assistant tool_calls message.
export const dedupDeepseekToolCallIdsMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  transformParams: async ({ params }) => {
    const prompt = params.prompt;

    // First pass: collect all tool_call_ids that appear in assistant messages
    const pendingToolCallIds = new Set<string>();
    const reordered: typeof prompt = [];

    for (const message of prompt) {
      if (message.role === 'assistant') {
        const toolCalls = (message as { toolCalls?: Array<{ toolCallId: string }> }).toolCalls;
        if (toolCalls?.length) {
          for (const tc of toolCalls) {
            pendingToolCallIds.add(tc.toolCallId);
          }
        }

        reordered.push(message);
      } else if (message.role === 'tool') {
        const toolCallId = (message as { toolCallId?: string }).toolCallId;

        // If this tool result matches a pending tool call, insert it right after
        // the most recent assistant message with tool_calls
        if (toolCallId && pendingToolCallIds.has(toolCallId)) {
          // Find the last assistant message with tool_calls
          let insertIdx = reordered.length;
          for (let i = reordered.length - 1; i >= 0; i--) {
            const m = reordered[i];
            if (m.role === 'assistant' && (m as { toolCalls?: unknown }).toolCalls) {
              insertIdx = i + 1;
              break;
            }
          }
          reordered.splice(insertIdx, 0, message);
          pendingToolCallIds.delete(toolCallId);
        } else {
          reordered.push(message);
        }
      } else {
        reordered.push(message);
      }
    }

    return { ...params, prompt: reordered };
  },
};
