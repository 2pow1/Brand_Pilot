import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, openDatabase } from '../src/db.js';
import { createCollectedContent, saveDraftForContent } from '../src/repository.js';

test('saves a draft and moves collected content to draft_created', () => {
  const db = openDatabase(':memory:');
  migrate(db);

  const item = createCollectedContent(db, {
    sourceId: 'source-a',
    sourceName: 'Source A',
    sourceUrl: 'https://example.com/article',
    sourceTitle: 'A useful article about branding',
    rawExcerpt: 'Short summary'
  });

  const updated = saveDraftForContent(
    db,
    item,
    {
      title: 'Draft title',
      body: 'Draft body',
      angle: 'Draft angle',
      keyPoints: ['one', 'two', 'three'],
      cta: 'Join'
    },
    { mode: 'mock' }
  );

  assert.equal(updated.status, 'draft_created');
  assert.equal(updated.draft_title, 'Draft title');
  assert.equal(updated.draft_body, 'Draft body');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM events').get().count, 2);

  db.close();
});
