import { DRAFT_RESPONSE_SCHEMA } from './schema.js';

/**
 * Extracts model text from the Responses API payload shape.
 */
export function extractResponseText(response) {
  if (typeof response.output_text === 'string') return response.output_text;

  const chunks = [];
  for (const output of response.output || []) {
    for (const content of output.content || []) {
      if (typeof content.text === 'string') chunks.push(content.text);
    }
  }

  return chunks.join('');
}

/**
 * Converts OpenAI schema field names into the app's draft object shape.
 */
function normalizeDraft(draft) {
  return {
    title: draft.title,
    body: draft.body,
    angle: draft.angle,
    keyPoints: draft.key_points,
    cta: draft.cta
  };
}

/**
 * Calls the OpenAI Responses API and returns a structured review-ready draft.
 */
export async function createOpenAiDraft({ config, prompt }) {
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required. Use --mock to generate a local draft without the API.');
  }

  const response = await fetch(`${config.openaiBaseUrl}/responses`, {
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
          name: 'brand_pilot_draft',
          strict: true,
          schema: DRAFT_RESPONSE_SCHEMA
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
    throw new Error('OpenAI response did not include output text');
  }

  return normalizeDraft(JSON.parse(text));
}
