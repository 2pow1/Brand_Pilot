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
  node src/cli.js collect [--dry-run] [--limit <n>]
  node src/cli.js transitions
`);
}

function parseOptions(argv) {
  const options = {
    dryRun: false,
    limit: 10
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--limit') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--limit must be a positive integer');
      }
      options.limit = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
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

async function runCollect(argv) {
  const options = parseOptions(argv);
  const { collectSources } = await import('./collect/index.js');
  const sources = loadJsonConfig(resolve(process.cwd(), 'config/sources.json'));
  const collection = await collectSources(sources, {
    maxCandidatesPerSource: options.limit
  });

  if (options.dryRun) {
    console.log(JSON.stringify(collection, null, 2));
    return;
  }

  const { createCollectedContentIfNew } = await import('./repository.js');
  const { db, databasePath, dbApi } = await openAppDatabase();
  const stored = [];
  const skipped = [];

  for (const result of collection.results) {
    for (const candidate of result.candidates) {
      const { item, created } = createCollectedContentIfNew(db, candidate);
      const bucket = created ? stored : skipped;
      bucket.push({
        id: item.id,
        sourceId: item.source_id,
        title: item.source_title,
        status: item.status
      });
    }
  }

  console.log(`Database: ${databasePath}`);
  console.log(JSON.stringify({
    fetchedSources: collection.results.length,
    failedSources: collection.errors,
    storedCount: stored.length,
    skippedDuplicateCount: skipped.length,
    stored,
    skipped,
    summary: dbApi.summarize(db)
  }, null, 2));
  db.close();
}

function runTransitions() {
  console.log(JSON.stringify(contentTransitions(), null, 2));
}

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  if (command === 'init') await runInit();
  else if (command === 'status') await runStatus();
  else if (command === 'sample') await runSample();
  else if (command === 'collect') await runCollect(args);
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
