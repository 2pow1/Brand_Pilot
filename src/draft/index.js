import { buildDraftPrompt } from './prompt.js';
import { createMockDraft } from './mock.js';
import { createOpenAiDraft } from './openai.js';

/**
 * Creates either a mock or OpenAI-backed common draft for a collected content item.
 */
export async function createDraft({ config, brand, item, mock = false }) {
  const prompt = buildDraftPrompt({ brand, item });

  if (mock) {
    return createMockDraft({ brand, item });
  }

  return createOpenAiDraft({ config, prompt });
}
