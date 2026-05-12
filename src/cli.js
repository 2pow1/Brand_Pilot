#!/usr/bin/env node

import { resolve } from 'node:path';
import { databasePathFromUrl, loadConfig, loadJsonConfig } from './config.js';
import { fingerprint } from './ids.js';
import { CONTENT_STATUSES, contentTransitions } from './state.js';

function printUsage() {
  console.log(`Brand Pilot CLI

Usage:
  node src/cli.js init
  node src/cli.js status
  node src/cli.js sample
  node src/cli.js transitions
`);
}

async function openAppDatabase() {
  const dbApi = await import('./db.js');
  const config = loadConfig();
  const databasePath = databasePathFromUrl(config.databaseUrl, config.cwd);
  const db = dbApi.openDatabase(databasePath);
  dbApi.migrate(db);
  return { db, databasePath, dbApi };
}

function printSummary(summary) {
  console.log(JSON.stringify(summary, null, 2));
}

async function runInit() {
  const { db, databasePath } = await openAppDatabase();
  db.close();
  console.log(`Initialized database: ${databasePath}`);
}

async function runStatus() {
  const { db, databasePath, dbApi } = await openAppDatabase();
  console.log(`Database: ${databasePath}`);
  printSummary(dbApi.summarize(db));
  db.close();
}

async function runSample() {
  const { createCollectedContent, transitionContent } = await import('./repository.js');
  const { db, databasePath, dbApi } = await openAppDatabase();
  const sources = loadJsonConfig(resolve(process.cwd(), 'config/sources.json'));
  const firstSource = sources.find((source) => source.enabled);

  if (!firstSource) {
    throw new Error('No enabled source found in config/sources.json');
  }

  const sampleTitle = `Sample branding insight for MVP wiring ${new Date().toISOString()}`;
  const item = createCollectedContent(db, {
    sourceId: firstSource.id,
    sourceName: firstSource.name,
    sourceUrl: firstSource.url,
    sourceTitle: sampleTitle,
    rawExcerpt: 'This sample row verifies local database setup and state transitions.'
  });

  const drafted = transitionContent(db, item, CONTENT_STATUSES.DRAFT_CREATED, {
    draftFingerprint: fingerprint(sampleTitle)
  });
  const pending = transitionContent(db, drafted, CONTENT_STATUSES.PENDING_REVIEW);

  console.log(`Database: ${databasePath}`);
  console.log(`Created sample content item: ${pending.id}`);
  printSummary(dbApi.summarize(db));
  db.close();
}

function runTransitions() {
  console.log(JSON.stringify(contentTransitions(), null, 2));
}

const command = process.argv[2];

async function main() {
  if (command === 'init') await runInit();
  else if (command === 'status') await runStatus();
  else if (command === 'sample') await runSample();
  else if (command === 'transitions') runTransitions();
  else {
    printUsage();
    process.exitCode = command ? 1 : 0;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
