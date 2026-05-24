import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase, migrate } from '../src/db.js';
import { createSqliteStore } from '../src/database/sqlite-store.js';
import { createCollectedContentIfNew, markContentNotionSynced } from '../src/repository.js';

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
