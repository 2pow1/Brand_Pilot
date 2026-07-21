import { resolve } from 'node:path';
import { loadBrandConfig, loadConfig, loadJsonConfig } from '../src/config.js';
import { openDatabaseStore } from '../src/database/index.js';
import { CONTENT_STATUSES } from '../src/state.js';
import { buildInstagramChannelPrompt } from '../src/channel/prompt.js';
import { INSTAGRAM_CHANNEL_RESPONSE_SCHEMA } from '../src/channel/schema.js';
import { applyInstagramCardNewsAdaptation } from '../src/channel/instagram.js';
import { extractResponseText } from '../src/draft/openai.js';

const contentId = process.argv[2];
const promptOnly = process.argv.includes('--prompt-only');

const config = loadConfig();
const brand = loadBrandConfig(config.cwd);
const channels = loadJsonConfig(resolve(config.cwd, 'config/channels.json'));
const channel = channels.find((item) => item.enabled && item.id === 'instagram');

if (!channel) {
  throw new Error('Enabled Instagram channel not found in config/channels.json');
}

const store = await openDatabaseStore(config);

try {
  const item = contentId
    ? await store.getContentItem(contentId)
    : (await store.listContentItemsByStatus(CONTENT_STATUSES.APPROVED, { limit: 1 }))[0];

  if (!item) {
    throw new Error('No content item found. Pass a content ID or approve one draft first.');
  }

  const prompt = buildInstagramChannelPrompt({
    brand,
    item,
    channel
  });

  console.log('\n=== CONTENT ===');
  console.log({
    id: item.id,
    status: item.status,
    sourceTitle: item.source_title,
    draftTitle: item.draft_title
  });

  console.log('\n=== SYSTEM PROMPT ===');
  console.log(prompt.system);

  console.log('\n=== USER PROMPT ===');
  console.log(prompt.user);

  if (promptOnly) {
    process.exit(0);
  }

  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required for real API test.');
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
          name: 'brand_pilot_instagram_channel',
          strict: true,
          schema: INSTAGRAM_CHANNEL_RESPONSE_SCHEMA
        }
      }
    })
  });

  const raw = await response.json().catch(() => ({}));

  console.log('\n=== OPENAI RAW RESPONSE ===');
  console.dir(raw, { depth: null });

  if (!response.ok) {
    throw new Error(raw.error?.message || `OpenAI request failed: HTTP ${response.status}`);
  }

  const outputText = extractResponseText(raw);
  const channelJson = JSON.parse(outputText);

  console.log('\n=== PARSED CHANNEL JSON FROM GPT ===');
  console.dir(channelJson, { depth: null });

  const finalPayload = applyInstagramCardNewsAdaptation({
    brand,
    item,
    channel,
    adaptation: channelJson
  });

  console.log('\n=== FINAL INSTAGRAM PAYLOAD ===');
  console.dir(finalPayload, { depth: null });
} finally {
  await store.close();
}