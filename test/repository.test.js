import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase, migrate } from '../src/db.js';
import { createSqliteStore } from '../src/database/sqlite-store.js';
import { createCollectedContentIfNew, markContentNotionSynced } from '../src/repository.js';
import { markChannelOutputNotionBackedUp, markChannelOutputStorageCleaned } from '../src/repository.js';

test('does not insert duplicate collected candidates', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const store = createSqliteStore(db);

  const candidate = {
    sourceId: 'source-a',
    sourceName: 'Source A',
    sourceUrl: 'https://example.com/article/one',
    sourceTitle: 'A useful article about branding',
    rawExcerpt: 'Short summary'
  };

  const first = await createCollectedContentIfNew(store, candidate);
  const second = await createCollectedContentIfNew(store, candidate);

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.item.id, second.item.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM content_items').get().count, 1);

  await store.close();
});

test('stores Notion page id after mirror sync', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const store = createSqliteStore(db);
  const candidate = {
    sourceId: 'source-a',
    sourceName: 'Source A',
    sourceUrl: 'https://example.com/article/two',
    sourceTitle: 'A second article about branding',
    rawExcerpt: 'Short summary'
  };
  const { item } = await createCollectedContentIfNew(store, candidate);
  const updated = await markContentNotionSynced(store, item, 'page_123', {
    action: 'created'
  });

  assert.equal(updated.notion_page_id, 'page_123');
  assert.ok(updated.notion_synced_at);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'content.notion.synced'").get().count, 1);

  await store.close();
});

test('lists Notion sync rows with Instagram channel backup fields', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const store = createSqliteStore(db);
  const { item } = await createCollectedContentIfNew(store, {
    sourceId: 'source-a',
    sourceName: 'Source A',
    sourceUrl: 'https://example.com/article/three',
    sourceTitle: 'A third article about branding',
    rawExcerpt: 'Short summary'
  });
  await store.upsertChannelOutput({
    contentItemId: item.id,
    channelId: 'instagram',
    payload: {
      caption: 'Caption',
      hashtags: ['#brand'],
      slides: [{ index: 1 }, { index: 2 }]
    },
    eventType: 'content.channel.generated',
    eventPayload: {
      channelId: 'instagram'
    }
  });

  const rows = await store.listContentItemsForNotionSync({ limit: 1 });

  assert.equal(rows[0].id, item.id);
  assert.equal(rows[0].notion_channel_id, 'instagram');
  assert.equal(rows[0].notion_channel_status, 'generated');
  assert.match(rows[0].notion_channel_payload_json, /Caption/);

  await store.close();
});

test('lists and marks channel artifacts backed up to Notion files', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const store = createSqliteStore(db);
  const { item } = await createCollectedContentIfNew(store, {
    sourceId: 'source-a',
    sourceName: 'Source A',
    sourceUrl: 'https://example.com/article/four',
    sourceTitle: 'A fourth article about branding',
    rawExcerpt: 'Short summary'
  });
  const synced = await markContentNotionSynced(store, item, 'page_123');
  const output = await store.upsertChannelOutput({
    contentItemId: synced.id,
    channelId: 'instagram',
    status: 'publish_pending',
    payload: {
      caption: 'Caption',
      slides: [{ index: 1 }, { index: 2 }]
    },
    artifactPath: 'https://storage.example.com/instagram/content_123/manifest.json',
    eventType: 'content.channel.generated'
  });
  const ready = await store.listChannelOutputsReadyForNotionBackup({
    channelId: 'instagram',
    limit: 10
  });

  assert.equal(ready.length, 1);
  assert.equal(ready[0].notion_page_id, 'page_123');
  assert.equal(ready[0].channel_artifact_path, 'https://storage.example.com/instagram/content_123/manifest.json');

  const backedUp = await markChannelOutputNotionBackedUp(store, synced, output, {
    files: [{ id: 'file_upload_1', filename: 'slide-01.png' }]
  });
  const readyAfterBackup = await store.listChannelOutputsReadyForNotionBackup({
    channelId: 'instagram',
    limit: 10
  });

  assert.equal(backedUp.output.backup_status, 'backed_up');
  assert.ok(backedUp.output.backup_completed_at);
  assert.equal(readyAfterBackup.length, 0);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'content.notion.artifacts_backed_up'").get()
      .count,
    1
  );

  await store.close();
});

test('lists backed-up published artifacts and records Storage cleanup', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const store = createSqliteStore(db);
  const item = await store.insertContentItem({
    sourceId: 'source-a',
    sourceName: 'Source A',
    sourceUrl: 'https://example.com/article/five',
    sourceTitle: 'A fifth article about branding',
    sourceFingerprint: 'source-a:fifth',
    rawExcerpt: 'Short summary',
    status: 'published'
  });
  const output = await store.upsertChannelOutput({
    contentItemId: item.id,
    channelId: 'instagram',
    status: 'published',
    payload: {
      caption: 'Caption'
    },
    artifactPath:
      'https://project.supabase.co/storage/v1/object/public/brand-pilot-instagram/instagram/content_123/channel_456/manifest.json',
    publishedUrl: 'https://www.instagram.com/p/example/',
    eventType: 'content.channel.generated'
  });
  await store.updateChannelOutputBackup({
    id: output.id,
    backupStatus: 'backed_up',
    backupPayload: {
      files: [{ id: 'file_upload_1' }]
    },
    backupError: ''
  });

  const ready = await store.listChannelOutputsReadyForStorageCleanup({
    channelId: 'instagram',
    limit: 10
  });

  assert.equal(ready.length, 1);
  assert.equal(ready[0].channel_backup_status, 'backed_up');

  const cleaned = await markChannelOutputStorageCleaned(store, ready[0], ready[0], {
    deletedCount: 2
  });
  const readyAfterCleanup = await store.listChannelOutputsReadyForStorageCleanup({
    channelId: 'instagram',
    limit: 10
  });

  assert.equal(cleaned.output.artifact_path, '');
  assert.equal(readyAfterCleanup.length, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'content.storage.cleaned'").get().count, 1);

  await store.close();
});
