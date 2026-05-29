import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_DATABASE_URL = 'file:./data/brand-pilot.sqlite';
const DEFAULT_DATABASE_PROVIDER = 'sqlite';
const DEFAULT_SUPABASE_SCHEMA = 'public';
const DEFAULT_SUPABASE_STORAGE_BUCKET = 'brand-pilot-instagram';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_DISCORD_BASE_URL = 'https://discord.com/api/v10';
const DEFAULT_META_GRAPH_BASE_URL = 'https://graph.facebook.com/v25.0';
const DEFAULT_NOTION_BASE_URL = 'https://api.notion.com/v1';
const DEFAULT_NOTION_VERSION = '2026-03-11';
const DEFAULT_BRAND_COMPANY_NAME = 'GrowthLine';
const DEFAULT_BRAND_VOICE = 'clear, practical, founder-friendly';
const DEFAULT_BRAND_SERVICE_SUMMARY = 'Branding and marketing support for small businesses.';

/**
 * Parses simple KEY=value lines from a local .env file.
 */
function parseDotEnv(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

/**
 * Loads the optional local .env file for CLI runs.
 */
function loadDotEnv(cwd) {
  const path = resolve(cwd, '.env');
  if (!existsSync(path)) return {};

  return parseDotEnv(readFileSync(path, 'utf8'));
}

/**
 * Merges local .env values and process environment into the runtime configuration object.
 */
export function loadConfig({ cwd = process.cwd(), env = process.env } = {}) {
  const dotEnv = loadDotEnv(cwd);
  const merged = { ...dotEnv, ...env };
  const databaseUrl = merged.DATABASE_URL || DEFAULT_DATABASE_URL;
  const databaseProvider =
    (merged.DATABASE_PROVIDER || DEFAULT_DATABASE_PROVIDER).trim().toLowerCase() ||
    DEFAULT_DATABASE_PROVIDER;

  return {
    cwd,
    databaseProvider,
    databaseUrl,
    supabaseUrl: merged.SUPABASE_URL || '',
    supabaseServiceRoleKey: merged.SUPABASE_SERVICE_ROLE_KEY || '',
    supabaseSchema: merged.SUPABASE_SCHEMA || DEFAULT_SUPABASE_SCHEMA,
    supabaseStorageBucket: merged.SUPABASE_STORAGE_BUCKET || DEFAULT_SUPABASE_STORAGE_BUCKET,
    openaiApiKey: merged.OPENAI_API_KEY || '',
    openaiModel: merged.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    openaiBaseUrl: merged.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL,
    discordBotToken: merged.DISCORD_BOT_TOKEN || '',
    discordReviewChannelId: merged.DISCORD_REVIEW_CHANNEL_ID || '',
    discordBaseUrl: merged.DISCORD_BASE_URL || DEFAULT_DISCORD_BASE_URL,
    discordPublicKey: merged.DISCORD_PUBLIC_KEY || '',
    notionToken: merged.NOTION_TOKEN || '',
    notionDatabaseId: merged.NOTION_DATABASE_ID || '',
    notionDataSourceId: merged.NOTION_DATA_SOURCE_ID || merged.NOTION_DATABASE_ID || '',
    notionBaseUrl: merged.NOTION_BASE_URL || DEFAULT_NOTION_BASE_URL,
    notionVersion: merged.NOTION_VERSION || DEFAULT_NOTION_VERSION,
    metaAccessToken: merged.META_ACCESS_TOKEN || '',
    metaAppId: merged.META_APP_ID || '',
    metaAppSecret: merged.META_APP_SECRET || '',
    metaGraphBaseUrl: merged.META_GRAPH_BASE_URL || DEFAULT_META_GRAPH_BASE_URL,
    metaTokenExpiryWarningDays: Number.parseInt(merged.META_TOKEN_EXPIRY_WARNING_DAYS || '7', 10),
    instagramBusinessAccountId: merged.INSTAGRAM_BUSINESS_ACCOUNT_ID || ''
  };
}

/**
 * Reads a JSON configuration file from disk.
 */
export function loadJsonConfig(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Loads the real brand config when present, otherwise falls back to the example config.
 */
export function loadBrandConfig(cwd = process.cwd(), env = process.env) {
  const brandPath = resolve(cwd, 'config/brand.json');
  const examplePath = resolve(cwd, 'config/brand.example.json');
  const brand = loadJsonConfig(existsSync(brandPath) ? brandPath : examplePath);
  const dotEnv = loadDotEnv(cwd);
  const merged = { ...dotEnv, ...env };
  const ctaEnabled = String(merged.BRAND_CTA_ENABLED || brand.cta?.enabled || '').toLowerCase();
  const ctaUrl = merged.BRAND_CTA_URL ?? brand.cta?.url ?? '';
  const ctaLabel = merged.BRAND_CTA_LABEL ?? brand.cta?.label ?? '';

  return {
    ...brand,
    companyName: merged.BRAND_COMPANY_NAME || brand.companyName || DEFAULT_BRAND_COMPANY_NAME,
    brandVoice: merged.BRAND_VOICE || brand.brandVoice || DEFAULT_BRAND_VOICE,
    serviceSummary: merged.BRAND_SERVICE_SUMMARY || brand.serviceSummary || DEFAULT_BRAND_SERVICE_SUMMARY,
    cta: {
      ...(brand.cta || {}),
      enabled: ctaEnabled === 'true' || (ctaEnabled !== 'false' && Boolean(ctaUrl)),
      label: ctaLabel,
      url: ctaUrl
    }
  };
}

/**
 * Converts the local SQLite file URL into an absolute filesystem path.
 */
export function databasePathFromUrl(databaseUrl, cwd = process.cwd()) {
  if (!databaseUrl.startsWith('file:')) {
    throw new Error(`Only file: DATABASE_URL values are supported for the MVP. Received: ${databaseUrl}`);
  }

  return resolve(cwd, databaseUrl.slice('file:'.length));
}
