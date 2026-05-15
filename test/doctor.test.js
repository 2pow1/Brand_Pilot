import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDoctorReport, formatDoctorReport } from '../src/doctor.js';

test('reports missing scheduled pipeline configuration without exposing secrets', () => {
  const report = buildDoctorReport({
    databaseProvider: 'sqlite',
    supabaseUrl: '',
    supabaseServiceRoleKey: '',
    openaiApiKey: '',
    discordBotToken: '',
    discordReviewChannelId: '',
    notionToken: '',
    notionDataSourceId: ''
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.missing, [
    'DATABASE_PROVIDER',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'DISCORD_BOT_TOKEN',
    'DISCORD_REVIEW_CHANNEL_ID',
    'NOTION_TOKEN',
    'NOTION_DATA_SOURCE_ID'
  ]);

  const text = formatDoctorReport(report);
  assert.match(text, /SUPABASE_URL/);
  assert.doesNotMatch(text, /service-role-key/);
});

test('passes scheduled pipeline configuration when required values are set', () => {
  const report = buildDoctorReport({
    databaseProvider: 'supabase',
    supabaseUrl: 'https://project.supabase.co',
    supabaseServiceRoleKey: 'service-role-key',
    openaiApiKey: 'openai-key',
    discordBotToken: 'discord-token',
    discordReviewChannelId: 'discord-channel',
    notionToken: 'notion-token',
    notionDataSourceId: 'notion-data-source'
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.missing, []);
});

test('reports publish configuration separately from scheduled pipeline configuration', () => {
  const report = buildDoctorReport({
    metaAccessToken: '',
    instagramBusinessAccountId: '',
    supabaseStorageBucket: 'brand-pilot-instagram'
  }, 'publish');

  assert.equal(report.ok, false);
  assert.deepEqual(report.missing, ['META_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID']);
});
