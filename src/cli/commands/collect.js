import { resolve } from 'node:path';
import { collectSources } from '../../collect/index.js';
import { loadJsonConfig } from '../../config.js';
import { createCollectedContentIfNew } from '../../repository.js';
import { openAppDatabase } from '../database.js';
import { parseOptions } from '../options.js';
import { printDatabaseInfo } from '../output.js';

/**
 * Collects source candidates and optionally stores new ones in the configured database.
 */
export async function runCollect(argv) {
  const options = parseOptions(argv);
  const sources = loadJsonConfig(resolve(process.cwd(), 'config/sources.json'));
  const collection = await collectSources(sources, {
    maxCandidatesPerSource: options.limit
  });

  if (options.dryRun) {
    console.log(JSON.stringify(collection, null, 2));
    return;
  }

  const { store } = await openAppDatabase();
  const stored = [];
  const skipped = [];

  for (const result of collection.results) {
    for (const candidate of result.candidates) {
      const { item, created } = await createCollectedContentIfNew(store, candidate);
      const bucket = created ? stored : skipped;
      bucket.push({
        id: item.id,
        sourceId: item.source_id,
        title: item.source_title,
        status: item.status
      });
    }
  }

  printDatabaseInfo(store);
  console.log(JSON.stringify({
    fetchedSources: collection.results.length,
    failedSources: collection.errors,
    storedCount: stored.length,
    skippedDuplicateCount: skipped.length,
    stored,
    skipped,
    summary: await store.summarize()
  }, null, 2));
  await store.close();
}
