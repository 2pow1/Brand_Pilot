import { writeFileSync } from 'node:fs';

/**
 * Removes trailing slashes before appending an API path.
 */
function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

/**
 * Adds image-specific constraints so generated backgrounds do not contain text.
 */
export function buildImagePrompt(prompt) {
  return [
    prompt,
    '',
    'Strict requirements:',
    '- No readable text.',
    '- No letters, words, logo, watermark, signature, UI, or QR code.',
    '- Leave enough negative space for Korean headline text overlaid later.'
  ].join('\n');
}

/**
 * Saves a generated image response item to disk.
 */
async function writeImageResult({ image, outputPath, fetchImpl }) {
  if (image.b64_json) {
    writeFileSync(outputPath, Buffer.from(image.b64_json, 'base64'));
    return {
      source: 'b64_json',
      outputPath
    };
  }

  if (image.url) {
    const response = await fetchImpl(image.url);
    if (!response.ok) {
      throw new Error(`Failed to download generated image: HTTP ${response.status}`);
    }

    writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
    return {
      source: 'url',
      outputPath,
      url: image.url
    };
  }

  throw new Error('OpenAI image response did not include b64_json or url.');
}

/**
 * Generates a single image through the OpenAI Image API and writes it to disk.
 */
export async function generateOpenAiImage({ config, prompt, outputPath, fetchImpl = fetch }) {
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required for cover image generation.');
  }

  if (!prompt || !String(prompt).trim()) {
    throw new Error('Cover image generation requires a prompt.');
  }

  const body = {
    model: config.openaiImageModel,
    prompt: buildImagePrompt(prompt),
    size: config.openaiImageSize,
    quality: config.openaiImageQuality,
    n: 1
  };

  const response = await fetchImpl(`${trimTrailingSlash(config.openaiBaseUrl)}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI image request failed: HTTP ${response.status}`);
  }

  const image = payload.data?.[0];
  if (!image) {
    throw new Error('OpenAI image response did not include any image data.');
  }

  return {
    ...(await writeImageResult({
      image,
      outputPath,
      fetchImpl
    })),
    model: config.openaiImageModel,
    size: payload.size || config.openaiImageSize,
    quality: payload.quality || config.openaiImageQuality,
    prompt: body.prompt,
    usage: payload.usage || null
  };
}
