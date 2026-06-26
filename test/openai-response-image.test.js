import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  extractResponseImageCalls,
  generateOpenAiResponseImages
} from '../src/openai/response-image.js';

test('extracts Responses API image generation calls', () => {
  const calls = extractResponseImageCalls({
    output: [
      { type: 'message', content: [{ type: 'output_text', text: 'Done' }] },
      { type: 'image_generation_call', id: 'ig_1', status: 'completed', result: 'abc' },
      { type: 'image_generation_call', id: 'ig_2', status: 'completed', result: '' }
    ]
  });

  assert.deepEqual(calls, [
    {
      id: 'ig_1',
      status: 'completed',
      result: 'abc'
    }
  ]);
});

test('writes base64 Responses image outputs to disk', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-pilot-response-image-'));
  const fetchImpl = async (url, options) => {
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.match(options.headers['X-Client-Request-Id'], /^brand-pilot-/);

    const body = JSON.parse(options.body);
    assert.equal(body.model, 'gpt-test');
    assert.equal(body.input, 'Generate cards');
    assert.deepEqual(body.tools, [{ type: 'image_generation', action: 'generate' }]);

    return Response.json(
      {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Created two slides.' }]
          },
          {
            type: 'image_generation_call',
            id: 'ig_1',
            status: 'completed',
            result: Buffer.from('first-image').toString('base64')
          },
          {
            type: 'image_generation_call',
            id: 'ig_2',
            status: 'completed',
            result: Buffer.from('second-image').toString('base64')
          }
        ],
        usage: {
          total_tokens: 123
        }
      },
      {
        headers: {
          'x-request-id': 'req_123'
        }
      }
    );
  };

  const result = await generateOpenAiResponseImages({
    config: {
      openaiApiKey: 'test-key',
      openaiBaseUrl: 'https://api.openai.com/v1',
      openaiModel: 'gpt-test'
    },
    prompt: 'Generate cards',
    outputDir: dir,
    fetchImpl
  });

  assert.equal(result.responseId, 'resp_123');
  assert.equal(result.requestId, 'req_123');
  assert.equal(result.images.length, 2);
  assert.equal(existsSync(join(dir, 'slide-01.png')), true);
  assert.equal(existsSync(join(dir, 'slide-02.png')), true);
  assert.equal(readFileSync(join(dir, 'slide-01.png'), 'utf8'), 'first-image');
  assert.equal(readFileSync(join(dir, 'slide-02.png'), 'utf8'), 'second-image');
  assert.match(result.outputText, /Created two slides/);
});

test('requires an OpenAI API key for Responses image generation', async () => {
  await assert.rejects(
    () =>
      generateOpenAiResponseImages({
        config: {
          openaiApiKey: '',
          openaiBaseUrl: 'https://api.openai.com/v1',
          openaiModel: 'gpt-test'
        },
        prompt: 'Generate cards',
        outputDir: join(tmpdir(), 'brand-pilot-response-image')
      }),
    /OPENAI_API_KEY/
  );
});

test('fails when a Responses payload has no generated image outputs', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-pilot-response-image-empty-'));

  await assert.rejects(
    () =>
      generateOpenAiResponseImages({
        config: {
          openaiApiKey: 'test-key',
          openaiBaseUrl: 'https://api.openai.com/v1',
          openaiModel: 'gpt-test'
        },
        prompt: 'Generate cards',
        outputDir: dir,
        fetchImpl: async () =>
          Response.json({
            id: 'resp_empty',
            output: [{ type: 'message', content: [{ type: 'output_text', text: 'No image.' }] }]
          })
      }),
    /image_generation_call/
  );
});

