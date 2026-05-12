import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase, migrate } from '../src/db.js';
import { createCollectedContentIfNew } from '../src/repository.js';

test('does not insert duplicate collected candidates', () => {
  const db = openDatabase(':memory:');
  migrate(db);

  const candidate = {
    sourceId: 'source-a',
    sourceName: 'Source A',
    sourceUrl: 'https://example.com/article/one',
    sourceTitle: 'A useful article about branding',
    rawExcerpt: 'Short summary'
  };

  const first = createCollectedContentIfNew(db, candidate);
  const second = createCollectedContentIfNew(db, candidate);

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.item.id, second.item.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM content_items').get().count, 1);

  db.close();
});
