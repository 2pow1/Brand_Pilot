import { extractResponseText } from '../draft/openai.js';
import { INSTAGRAM_CHANNEL_RESPONSE_SCHEMA } from './schema.js';
import { applyInstagramCardNewsAdaptation } from './instagram.js';
import { buildInstagramChannelPrompt } from './prompt.js';

/**
 * Calls the OpenAI Responses API for channel-specific Instagram adaptation.
 */
export async function createOpenAiInstagramCardNewsPayload({
  config,
  brand,
  item,
  channel,
  fetchImpl = fetch
}) {
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required for channel-specific GPT generation. Use --mock for template output.');
  }

  const prompt = buildInstagramChannelPrompt({ brand, item, channel });
  const response = await fetchImpl(`${config.openaiBaseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.openaiModel,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: prompt.system }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt.user }]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'brand_pilot_instagram_channel',
          strict: true,
          schema: INSTAGRAM_CHANNEL_RESPONSE_SCHEMA
        }
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI request failed: HTTP ${response.status}`);
  }

  const text = extractResponseText(payload);
  if (!text) {
    throw new Error('OpenAI response did not include channel output text');
  }

  return applyInstagramCardNewsAdaptation({
    brand,
    item,
    channel,
    adaptation: JSON.parse(text)
  });
}
