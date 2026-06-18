import { requestOpenAiJsonResponse } from '../openai/responses.js';
import { INSTAGRAM_SKETCH_CARD_NEWS_PROMPT_SPEC } from '../prompts/instagram/sketch-card-news-v2/index.js';
import { INSTAGRAM_CHANNEL_RESPONSE_SCHEMA } from './schema.js';
import { applyInstagramCardNewsAdaptation, applyInstagramSketchCardNewsAdaptation } from './instagram.js';
import { buildInstagramChannelPrompt } from './prompt.js';

/**
 * Selects the prompt, schema, and adapter for the configured Instagram template.
 */
function instagramTemplateSpec(channel) {
  if (channel.template === 'instagram-sketch-card-news-v2') {
    return {
      responseName: INSTAGRAM_SKETCH_CARD_NEWS_PROMPT_SPEC.responseName,
      schema: INSTAGRAM_SKETCH_CARD_NEWS_PROMPT_SPEC.schema,
      prompt: INSTAGRAM_SKETCH_CARD_NEWS_PROMPT_SPEC.buildPrompt,
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
  const spec = instagramTemplateSpec(channel);
  const prompt = spec.prompt({ config, brand, item, channel });
  const adaptation = await requestOpenAiJsonResponse({
    config,
    prompt,
    responseName: spec.responseName,
    schema: spec.schema,
    fetchImpl,
    apiKeyErrorMessage: 'OPENAI_API_KEY is required for channel-specific GPT generation. Use --mock for template output.',
    emptyResponseErrorMessage: 'OpenAI response did not include channel output text'
  });

  return spec.apply({
    brand,
    item,
    channel,
    adaptation
  });
}
