import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildImagePrompt, generateOpenAiImage } from '../src/openai/image.js';

test('adds no-text constraints to image prompts', () => {
  const prompt = buildImagePrompt('Sketch-note background');

  assert.match(prompt, /Sketch-note background/);
  assert.match(prompt, /No readable text/);
  assert.match(prompt, /Korean headline text/);
});

test('writes base64 OpenAI image output to disk', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-pilot-image-'));
  const outputPath = join(dir, 'cover.png');
  const fetchImpl = async (url, options) => {
    assert.equal(String(url), 'https://api.openai.com/v1/images/generations');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'gpt-image-1');
    assert.equal(body.size, '1024x1536');
    assert.equal(body.quality, 'medium');

    return Response.json({
      data: [
        {
          b64_json: Buffer.from('png-bytes').toString('base64')
        }
      ],
      size: '1024x1536',
      quality: 'medium'
    });
  };

  const result = await generateOpenAiImage({
    config: {
      openaiApiKey: 'test-key',
      openaiBaseUrl: 'https://api.openai.com/v1',
      openaiImageModel: 'gpt-image-1',
      openaiImageSize: '1024x1536',
      openaiImageQuality: 'medium'
    },
    prompt: 'Background only',
    outputPath,
    fetchImpl
  });

  assert.equal(result.source, 'b64_json');
  assert.equal(existsSync(outputPath), true);
  assert.equal(readFileSync(outputPath, 'utf8'), 'png-bytes');
});

test('requires an OpenAI API key for image generation', async () => {
  await assert.rejects(
    () =>
      generateOpenAiImage({
        config: {
          openaiApiKey: ''
        },
        prompt: 'Background only',
        outputPath: join(tmpdir(), 'cover.png')
      }),
    /OPENAI_API_KEY/
  );
});
