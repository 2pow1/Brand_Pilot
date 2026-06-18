import { resolve } from 'node:path';
import { loadJsonConfig } from '../../config.js';
import { fingerprint } from '../../ids.js';
import { createCollectedContent, transitionContent } from '../../repository.js';
import { CONTENT_STATUSES } from '../../state.js';
import { openAppDatabase } from '../database.js';
import { printDatabaseInfo, printSummary } from '../output.js';

/**
 * Creates a local sample content row and moves it to pending review for wiring tests.
 */
export async function runSample() {
  const { store } = await openAppDatabase();
  const sources = loadJsonConfig(resolve(process.cwd(), 'config/sources.json'));
  const firstSource = sources.find((source) => source.enabled);

  if (!firstSource) {
    throw new Error('No enabled source found in config/sources.json');
  }

  const sampleTitle = `Sample branding insight for MVP wiring ${new Date().toISOString()}`;
  const item = await createCollectedContent(store, {
    sourceId: firstSource.id,
    sourceName: firstSource.name,
    sourceUrl: firstSource.url,
    sourceTitle: sampleTitle,
    rawExcerpt: 'This sample row verifies local database setup and state transitions.'
  });

  const drafted = await transitionContent(store, item, CONTENT_STATUSES.DRAFT_CREATED, {
    draftFingerprint: fingerprint(sampleTitle)
  });
  const pending = await transitionContent(store, drafted, CONTENT_STATUSES.PENDING_REVIEW);

  printDatabaseInfo(store);
  console.log(`Created sample content item: ${pending.id}`);
  printSummary(await store.summarize());
  await store.close();
}
