import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { applyChannelOverrides, loadBrandConfig, loadConfig } from '../src/config.js';

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

test('loads Meta publish preflight settings', () => {
  const config = loadConfig({
    cwd: EMPTY_ENV_CWD,
    env: {
      META_ACCESS_TOKEN: 'meta-token',
      META_APP_ID: 'meta-app-id',
      META_APP_SECRET: 'meta-app-secret',
      META_TOKEN_EXPIRY_WARNING_DAYS: '10',
      INSTAGRAM_BUSINESS_ACCOUNT_ID: 'ig-business-id'
    }
  });

  assert.equal(config.metaAccessToken, 'meta-token');
  assert.equal(config.metaAppId, 'meta-app-id');
  assert.equal(config.metaAppSecret, 'meta-app-secret');
  assert.equal(config.metaTokenExpiryWarningDays, 10);
  assert.equal(config.instagramBusinessAccountId, 'ig-business-id');
});

test('loads brand identity overrides from environment', () => {
  const brand = loadBrandConfig(process.cwd(), {
    BRAND_COMPANY_NAME: 'GrowthLine',
    BRAND_VOICE: 'practical',
    BRAND_SERVICE_SUMMARY: 'Branding support',
    BRAND_CTA_ENABLED: 'false',
    BRAND_CTA_LABEL: 'Join',
    BRAND_CTA_URL: 'https://example.com/open-chat'
  });

  assert.equal(brand.companyName, 'GrowthLine');
  assert.equal(brand.brandVoice, 'practical');
  assert.equal(brand.serviceSummary, 'Branding support');
  assert.equal(brand.cta.enabled, false);
  assert.equal(brand.cta.label, 'Join');
  assert.equal(brand.cta.url, 'https://example.com/open-chat');
});

test('loads Instagram template override from environment', () => {
  const config = loadConfig({
    cwd: EMPTY_ENV_CWD,
    env: {
      INSTAGRAM_TEMPLATE: 'instagram-sketch-card-news-v2'
    }
  });

  assert.equal(config.instagramTemplate, 'instagram-sketch-card-news-v2');
});

test('applies Instagram template override to channel config', () => {
  const channels = applyChannelOverrides(
    [
      {
        id: 'instagram',
        template: 'instagram-card-news-v1'
      },
      {
        id: 'blog',
        template: 'blog-article-v1'
      }
    ],
    {
      instagramTemplate: 'instagram-sketch-card-news-v2'
    }
  );

  assert.equal(channels[0].template, 'instagram-sketch-card-news-v2');
  assert.equal(channels[1].template, 'blog-article-v1');
});

test('rejects unsupported Instagram template overrides', () => {
  assert.throws(
    () =>
      applyChannelOverrides(
        [
          {
            id: 'instagram',
            template: 'instagram-card-news-v1'
          }
        ],
        {
          instagramTemplate: 'unknown-template'
        }
      ),
    /Unsupported INSTAGRAM_TEMPLATE/
  );
});
