import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractResponseText, requestOpenAiJsonResponse } from '../src/openai/responses.js';

const schema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['ok'],
  properties: {
    ok: {
      type: 'boolean'
    }
  }
});

test('extracts Responses API output text from direct and nested payloads', () => {
  assert.equal(extractResponseText({ output_text: '{"ok":true}' }), '{"ok":true}');
  assert.equal(
    extractResponseText({
      output: [
        {
          content: [
            {
              type: 'output_text',
              text: '{"ok":'
            },
            {
              type: 'output_text',
              text: 'true}'
            }
          ]
        }
      ]
    }),
    '{"ok":true}'
  );
});

test('requests strict JSON schema output from the Responses API', async () => {
  const result = await requestOpenAiJsonResponse({
    config: {
      openaiApiKey: 'test-key',
      openaiBaseUrl: 'https://api.openai.test/v1/',
      openaiModel: 'gpt-test'
    },
    prompt: {
      system: 'system prompt',
      user: 'user prompt'
    },
    responseName: 'test_response',
    schema,
    fetchImpl: async (url, init) => {
      assert.equal(String(url), 'https://api.openai.test/v1/responses');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.Authorization, 'Bearer test-key');

      const body = JSON.parse(init.body);
      assert.equal(body.model, 'gpt-test');
      assert.equal(body.input[0].role, 'system');
      assert.equal(body.input[0].content[0].text, 'system prompt');
      assert.equal(body.input[1].role, 'user');
      assert.equal(body.input[1].content[0].text, 'user prompt');
      assert.equal(body.text.format.type, 'json_schema');
      assert.equal(body.text.format.name, 'test_response');
      assert.equal(body.text.format.strict, true);
      assert.deepEqual(body.text.format.schema, schema);

      return Response.json({
        output_text: JSON.stringify({
          ok: true
        })
      });
    }
  });

  assert.deepEqual(result, {
    ok: true
  });
});

test('uses caller-provided API key error text', async () => {
  await assert.rejects(
    () =>
      requestOpenAiJsonResponse({
        config: {
          openaiApiKey: '',
          openaiBaseUrl: 'https://api.openai.test/v1',
          openaiModel: 'gpt-test'
        },
        prompt: {
          system: 'system',
          user: 'user'
        },
        responseName: 'test_response',
        schema,
        apiKeyErrorMessage: 'custom key message'
      }),
    /custom key message/
  );
});

test('surfaces OpenAI error messages', async () => {
  await assert.rejects(
    () =>
      requestOpenAiJsonResponse({
        config: {
          openaiApiKey: 'test-key',
          openaiBaseUrl: 'https://api.openai.test/v1',
          openaiModel: 'gpt-test'
        },
        prompt: {
          system: 'system',
          user: 'user'
        },
        responseName: 'test_response',
        schema,
        fetchImpl: async () =>
          Response.json(
            {
              error: {
                message: 'bad request'
              }
            },
            {
              status: 400
            }
          )
      }),
    /bad request/
  );
});
