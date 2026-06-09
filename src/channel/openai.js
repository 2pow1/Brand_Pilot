import { extractResponseText } from '../draft/openai.js';
import { INSTAGRAM_CHANNEL_RESPONSE_SCHEMA, INSTAGRAM_SKETCH_CARD_NEWS_RESPONSE_SCHEMA } from './schema.js';
import { applyInstagramCardNewsAdaptation, applyInstagramSketchCardNewsAdaptation } from './instagram.js';
import { buildInstagramChannelPrompt, buildInstagramSketchCardNewsPrompt } from './prompt.js';

/**
 * Selects the prompt, schema, and adapter for the configured Instagram template.
 */
function instagramTemplateSpec(channel) {
  if (channel.template === 'instagram-sketch-card-news-v2') {
    return {
      responseName: 'brand_pilot_instagram_sketch_channel',
      schema: INSTAGRAM_SKETCH_CARD_NEWS_RESPONSE_SCHEMA,
      prompt: buildInstagramSketchCardNewsPrompt,
      apply: applyInstagramSketchCardNewsAdaptation
    };
  }

  return {
    responseName: 'brand_pilot_instagram_channel',
    schema: INSTAGRAM_CHANNEL_RESPONSE_SCHEMA,
    prompt: buildInstagramChannelPrompt,
    apply: applyInstagramCardNewsAdaptation
  };
}

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

  const spec = instagramTemplateSpec(channel);
  const prompt = spec.prompt({ config, brand, item, channel });
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
          name: spec.responseName,
          strict: true,
          schema: spec.schema
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

  return spec.apply({
    brand,
    item,
    channel,
    adaptation: JSON.parse(text)
  });
}
