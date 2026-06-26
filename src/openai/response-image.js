import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractResponseText } from './responses.js';

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function imageOutputPath(outputDir, prefix, index) {
  return join(outputDir, `${prefix}-${String(index).padStart(2, '0')}.png`);
}

function base64ImageBytes(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const base64 = text.includes(',') ? text.split(',').pop() : text;
  return Buffer.from(base64, 'base64');
}

export function extractResponseImageCalls(response) {
  const calls = [];

  for (const output of response.output || []) {
    if (output?.type !== 'image_generation_call') continue;
    if (typeof output.result !== 'string' || !output.result.trim()) continue;

    calls.push({
      id: output.id || '',
      status: output.status || '',
      result: output.result
    });
  }

  return calls;
}

export async function generateOpenAiResponseImages({
  config,
  prompt,
  outputDir,
  model = config?.openaiModel,
  outputNamePrefix = 'slide',
  fetchImpl = fetch
}) {
  if (!config?.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required for Responses image generation.');
  }

  if (!prompt || !String(prompt).trim()) {
    throw new Error('Responses image generation requires a prompt.');
  }

  if (!outputDir) {
    throw new Error('Responses image generation requires an output directory.');
  }

  mkdirSync(outputDir, { recursive: true });
  const clientRequestId = `brand-pilot-${randomUUID()}`;
  const body = {
    model,
    input: String(prompt),
    tools: [{ type: 'image_generation', action: 'generate' }]
  };

  const response = await fetchImpl(`${trimTrailingSlash(config.openaiBaseUrl)}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json',
      'X-Client-Request-Id': clientRequestId
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || `OpenAI response image request failed: HTTP ${response.status}`;
    throw new Error(message);
  }

  const imageCalls = extractResponseImageCalls(payload);
  if (imageCalls.length === 0) {
    throw new Error('OpenAI response did not include image_generation_call output.');
  }

  const images = imageCalls.map((call, index) => {
    const outputPath = imageOutputPath(outputDir, outputNamePrefix, index + 1);
    const bytes = base64ImageBytes(call.result);

    if (!bytes) {
      throw new Error(`OpenAI response image ${index + 1} did not include base64 image data.`);
    }

    writeFileSync(outputPath, bytes);
    return {
      index: index + 1,
      id: call.id,
      status: call.status,
      outputPath
    };
  });

  return {
    responseId: payload.id || '',
    requestId: response.headers?.get?.('x-request-id') || '',
    clientRequestId,
    model,
    outputText: extractResponseText(payload),
    outputTypes: (payload.output || []).map((output) => output.type).filter(Boolean),
    images,
    usage: payload.usage || null
  };
}

