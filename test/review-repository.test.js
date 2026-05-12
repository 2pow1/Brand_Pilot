import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, openDatabase } from '../src/db.js';
import { createSqliteStore } from '../src/database/sqlite-store.js';
import {
  approveContent,
  createCollectedContent,
  rejectContent,
  requestReviewForContent,
  saveDraftForContent
} from '../src/repository.js';

async function createDraftCreatedItem(store) {
  const item = await createCollectedContent(store, {
    sourceId: 'source-a',
    sourceName: 'Source A',
    sourceUrl: 'https://example.com/article',
    sourceTitle: 'A useful article about branding',
    rawExcerpt: 'Short summary'
  });

  return saveDraftForContent(store, item, {
    title: 'Draft title',
    body: 'Draft body',
    angle: 'Draft angle',
    keyPoints: ['one', 'two', 'three'],
    cta: 'Join'
  });
}

test('requests review and approves pending content', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const store = createSqliteStore(db);
  const drafted = await createDraftCreatedItem(store);
  const pending = await requestReviewForContent(store, drafted, 'message_1');
  const approved = await approveContent(store, pending);

  assert.equal(pending.status, 'pending_review');
  assert.equal(pending.review_message_id, 'message_1');
  assert.equal(approved.status, 'approved');

  await store.close();
});

test('requests review and rejects pending content', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const store = createSqliteStore(db);
  const drafted = await createDraftCreatedItem(store);
  const pending = await requestReviewForContent(store, drafted, 'message_1');
  const rejected = await rejectContent(store, pending, 'not relevant');

  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.rejection_reason, 'not relevant');

  await store.close();
});
