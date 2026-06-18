/**
 * Removes trailing slashes before appending an API path.
 */
function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

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
 * Calls the OpenAI Responses API with a strict JSON schema and returns parsed JSON.
 */
export async function requestOpenAiJsonResponse({
  config,
  prompt,
  responseName,
  schema,
  fetchImpl = fetch,
  apiKeyErrorMessage = 'OPENAI_API_KEY is required for GPT generation.',
  emptyResponseErrorMessage = 'OpenAI response did not include output text'
}) {
  if (!config.openaiApiKey) {
    throw new Error(apiKeyErrorMessage);
  }

  const response = await fetchImpl(`${trimTrailingSlash(config.openaiBaseUrl)}/responses`, {
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
          name: responseName,
          strict: true,
          schema
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
    throw new Error(emptyResponseErrorMessage);
  }

  return JSON.parse(text);
}
