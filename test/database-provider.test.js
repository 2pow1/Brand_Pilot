import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSqliteCliRuntime, describeDatabaseProvider } from '../src/database/provider.js';

test('describes sqlite as the local fallback provider', () => {
  const provider = describeDatabaseProvider({ databaseProvider: 'sqlite' });

  assert.equal(provider.provider, 'sqlite');
  assert.equal(provider.sourceOfTruth, false);
  assertSqliteCliRuntime({ databaseProvider: 'sqlite' });
});

test('describes supabase as the production source of truth', () => {
  const provider = describeDatabaseProvider({ databaseProvider: 'supabase' });

  assert.equal(provider.provider, 'supabase');
  assert.equal(provider.sourceOfTruth, true);
  assert.throws(
    () => assertSqliteCliRuntime({ databaseProvider: 'supabase' }),
    /still uses the SQLite adapter/
  );
});

test('rejects unsupported database providers', () => {
  assert.throws(
    () => describeDatabaseProvider({ databaseProvider: 'mysql' }),
    /Unsupported DATABASE_PROVIDER/
  );
});
