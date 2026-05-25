import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, openDatabase } from '../src/db.js';
import { createSqliteStore } from '../src/database/sqlite-store.js';
import {
  approveContent,
  createCollectedContent,
  markChannelOutputPublishFailed,
  markChannelOutputPublished,
  markChannelOutputRendered,
  markChannelOutputUploaded,
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

test('marks published channel output as published', async () => {
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
    'https://storage.example.com/instagram/content_123/manifest.json'
  );
  const published = await markChannelOutputPublished(
    store,
    rendered.item,
    {
      channel_output_id: rendered.output.id,
      output_channel_id: rendered.output.channel_id
    },
    'https://www.instagram.com/p/media_123/'
  );

  assert.equal(published.item.status, 'published');
  assert.equal(published.output.status, 'published');
  assert.equal(published.output.published_url, 'https://www.instagram.com/p/media_123/');

  await store.close();
});

test('records publish failures without moving content out of publish pending', async () => {
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
  const rendered = await markChannelOutputRendered(
    store,
    generated.item,
    {
      channel_output_id: generated.outputs[0].id,
      output_channel_id: generated.outputs[0].channel_id
    },
    'https://storage.example.com/instagram/content_123/manifest.json'
  );
  const failed = await markChannelOutputPublishFailed(
    store,
    rendered.item,
    {
      channel_output_id: rendered.output.id,
      output_channel_id: rendered.output.channel_id,
      channel_attempt_count: 0
    },
    'Token expired'
  );

  assert.equal(failed.item.status, 'publish_pending');
  assert.equal(failed.output.status, 'publish_pending');
  assert.equal(failed.output.attempt_count, 1);
  assert.equal(failed.output.last_error, 'Token expired');
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'content.channel.publish_failed'").get().count,
    1
  );

  await store.close();
});

test('marks uploaded channel artifact without changing publish pending status', async () => {
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
  const rendered = await markChannelOutputRendered(
    store,
    generated.item,
    {
      channel_output_id: generated.outputs[0].id,
      output_channel_id: generated.outputs[0].channel_id
    },
    'artifacts/generated/instagram/content_123'
  );
  const uploaded = await markChannelOutputUploaded(
    store,
    rendered.item,
    {
      channel_output_id: rendered.output.id,
      output_channel_id: rendered.output.channel_id
    },
    'https://storage.example.com/manifest.json'
  );

  assert.equal(uploaded.item.status, 'publish_pending');
  assert.equal(uploaded.output.status, 'publish_pending');
  assert.equal(uploaded.output.artifact_path, 'https://storage.example.com/manifest.json');
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'content.channel.uploaded'").get().count,
    1
  );

  await store.close();
});
