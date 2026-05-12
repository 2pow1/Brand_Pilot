import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, openDatabase } from '../src/db.js';
import { createSqliteStore } from '../src/database/sqlite-store.js';
import {
  approveContent,
  createCollectedContent,
  markChannelOutputRendered,
  requestReviewForContent,
  saveChannelOutputsForContent,
  saveDraftForContent
} from '../src/repository.js';

async function createApprovedItem(store) {
  const item = await createCollectedContent(store, {
    sourceId: 'source-a',
    sourceName: 'Source A',
    sourceUrl: 'https://example.com/article',
    sourceTitle: 'A useful article about branding',
    rawExcerpt: 'Short summary'
  });
  const drafted = await saveDraftForContent(store, item, {
    title: 'Draft title',
    body: 'Draft body',
    angle: 'Draft angle',
    keyPoints: ['one', 'two', 'three'],
    cta: 'Join'
  });
  const pending = await requestReviewForContent(store, drafted, 'message_1');
  return approveContent(store, pending);
}

test('stores channel output and moves approved content to channel_generated', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const store = createSqliteStore(db);

  const approved = await createApprovedItem(store);
  const result = await saveChannelOutputsForContent(store, approved, [
    {
      channelId: 'instagram',
      payload: {
        template: 'instagram-card-news-v1',
        slides: []
      }
    }
  ]);

  assert.equal(result.item.status, 'channel_generated');
  assert.equal(result.outputs.length, 1);
  assert.equal(result.outputs[0].channel_id, 'instagram');
  assert.equal(JSON.parse(result.outputs[0].payload_json).template, 'instagram-card-news-v1');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM channel_outputs').get().count, 1);

  await store.close();
});

test('marks rendered channel output as publish pending', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const store = createSqliteStore(db);

  const approved = await createApprovedItem(store);
  const generated = await saveChannelOutputsForContent(store, approved, [
    {
      channelId: 'instagram',
      payload: {
        template: 'instagram-card-news-v1',
        slides: []
      }
    }
  ]);
  const output = generated.outputs[0];
  const rendered = await markChannelOutputRendered(
    store,
    generated.item,
    {
      channel_output_id: output.id,
      output_channel_id: output.channel_id
    },
    'artifacts/generated/instagram/content_123'
  );

  assert.equal(rendered.item.status, 'publish_pending');
  assert.equal(rendered.output.status, 'publish_pending');
  assert.equal(rendered.output.artifact_path, 'artifacts/generated/instagram/content_123');

  await store.close();
});
