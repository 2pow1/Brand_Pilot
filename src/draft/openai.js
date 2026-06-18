import { requestOpenAiJsonResponse } from '../openai/responses.js';
import { DRAFT_RESPONSE_SCHEMA } from './schema.js';

export { extractResponseText } from '../openai/responses.js';

/**
 * Converts OpenAI schema field names into the app's draft object shape.
 */
function normalizeDraft(draft) {
  const cta = draft.cta || {};
  const hook = draft.hook || '';
  const body = draft.body || '';

  return {
    title: draft.title,
    hook,
    body: [hook, body].filter(Boolean).join('\n\n'),
    angle: draft.content_angle,
    keyPoints: draft.keywords,
    cta: cta.label || '',
    ctaUrl: cta.url || '',
    suggestedRepurpose: draft.suggested_repurpose || {}
  };
}

/**
 * Calls the OpenAI Responses API and returns a structured review-ready draft.
 */
export async function createOpenAiDraft({ config, prompt, fetchImpl = fetch }) {
  const draft = await requestOpenAiJsonResponse({
    config,
    prompt,
    responseName: 'brand_pilot_draft',
    schema: DRAFT_RESPONSE_SCHEMA,
    fetchImpl,
    apiKeyErrorMessage: 'OPENAI_API_KEY is required. Use --mock to generate a local draft without the API.'
  });

  return normalizeDraft(draft);
}
