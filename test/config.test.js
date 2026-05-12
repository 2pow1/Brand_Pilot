import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { loadConfig } from '../src/config.js';

const EMPTY_ENV_CWD = resolve(process.cwd(), 'tmp/no-env-config-test');

test('loads sqlite database provider by default', () => {
  const config = loadConfig({
    cwd: EMPTY_ENV_CWD,
    env: {}
  });

  assert.equal(config.databaseProvider, 'sqlite');
  assert.equal(config.databaseUrl, 'file:./data/brand-pilot.sqlite');
  assert.equal(config.supabaseSchema, 'public');
});

test('loads supabase database settings from environment', () => {
  const config = loadConfig({
    cwd: EMPTY_ENV_CWD,
    env: {
      DATABASE_PROVIDER: 'SUPABASE',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      SUPABASE_SCHEMA: 'brand_pilot'
    }
  });

  assert.equal(config.databaseProvider, 'supabase');
  assert.equal(config.supabaseUrl, 'https://project.supabase.co');
  assert.equal(config.supabaseServiceRoleKey, 'service-role-key');
  assert.equal(config.supabaseSchema, 'brand_pilot');
});

test('loads notion data source settings with database id fallback', () => {
  const config = loadConfig({
    cwd: EMPTY_ENV_CWD,
    env: {
      NOTION_TOKEN: 'notion-token',
      NOTION_DATABASE_ID: 'legacy-database-id'
    }
  });

  assert.equal(config.notionToken, 'notion-token');
  assert.equal(config.notionDataSourceId, 'legacy-database-id');
  assert.equal(config.notionBaseUrl, 'https://api.notion.com/v1');
  assert.equal(config.notionVersion, '2026-03-11');
});
