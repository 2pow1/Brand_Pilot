import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_DATABASE_URL = 'file:./data/brand-pilot.sqlite';

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

function loadDotEnv(cwd) {
  const path = resolve(cwd, '.env');
  if (!existsSync(path)) return {};

  return parseDotEnv(readFileSync(path, 'utf8'));
}

export function loadConfig({ cwd = process.cwd(), env = process.env } = {}) {
  const dotEnv = loadDotEnv(cwd);
  const merged = { ...dotEnv, ...env };
  const databaseUrl = merged.DATABASE_URL || DEFAULT_DATABASE_URL;

  return {
    cwd,
    databaseUrl,
    openaiApiKey: merged.OPENAI_API_KEY || '',
    discordBotToken: merged.DISCORD_BOT_TOKEN || '',
    discordReviewChannelId: merged.DISCORD_REVIEW_CHANNEL_ID || '',
    notionToken: merged.NOTION_TOKEN || '',
    notionDatabaseId: merged.NOTION_DATABASE_ID || '',
    metaAccessToken: merged.META_ACCESS_TOKEN || '',
    instagramBusinessAccountId: merged.INSTAGRAM_BUSINESS_ACCOUNT_ID || ''
  };
}

export function loadJsonConfig(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function databasePathFromUrl(databaseUrl, cwd = process.cwd()) {
  if (!databaseUrl.startsWith('file:')) {
    throw new Error(`Only file: DATABASE_URL values are supported for the MVP. Received: ${databaseUrl}`);
  }

  return resolve(cwd, databaseUrl.slice('file:'.length));
}
