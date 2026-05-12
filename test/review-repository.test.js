import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, openDatabase } from '../src/db.js';
import {
  approveContent,
  createCollectedContent,
  rejectContent,
  requestReviewForContent,
  saveDraftForContent
} from '../src/repository.js';

function createDraftCreatedItem(db) {
  const item = createCollectedContent(db, {
    sourceId: 'source-a',
    sourceName: 'Source A',
    sourceUrl: 'https://example.com/article',
    sourceTitle: 'A useful article about branding',
    rawExcerpt: 'Short summary'
  });

  return saveDraftForContent(db, item, {
    title: 'Draft title',
    body: 'Draft body',
    angle: 'Draft angle',
    keyPoints: ['one', 'two', 'three'],
    cta: 'Join'
  });
}

test('requests review and approves pending content', () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const drafted = createDraftCreatedItem(db);
  const pending = requestReviewForContent(db, drafted, 'message_1');
  const approved = approveContent(db, pending);

  assert.equal(pending.status, 'pending_review');
  assert.equal(pending.review_message_id, 'message_1');
  assert.equal(approved.status, 'approved');

  db.close();
});

test('requests review and rejects pending content', () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const drafted = createDraftCreatedItem(db);
  const pending = requestReviewForContent(db, drafted, 'message_1');
  const rejected = rejectContent(db, pending, 'not relevant');

  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.rejection_reason, 'not relevant');

  db.close();
});
