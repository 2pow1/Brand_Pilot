import { loadBrandConfig, loadConfig } from '../../config.js';
import { createDraft } from '../../draft/index.js';
import { saveDraftForContent } from '../../repository.js';
import { CONTENT_STATUSES } from '../../state.js';
import { openAppDatabase } from '../database.js';
import { parseOptions } from '../options.js';
import { printDatabaseInfo } from '../output.js';

/**
 * Creates common drafts for collected content using mock or OpenAI-backed generation.
 */
export async function runDraft(argv) {
  const options = parseOptions(argv);
  const config = loadConfig();
  const brand = loadBrandConfig(config.cwd);
  const { store } = await openAppDatabase();
  const items = await store.listContentItemsByStatus(CONTENT_STATUSES.COLLECTED, {
    limit: options.limit
  });
  const drafted = [];
  const failed = [];

  for (const item of items) {
    try {
      const draft = await createDraft({
        config,
        brand,
        item,
        mock: options.mock
      });
      const updated = await saveDraftForContent(store, item, draft, {
        mode: options.mock ? 'mock' : 'openai',
        model: options.mock ? 'mock' : config.openaiModel
      });

      drafted.push({
        id: updated.id,
        sourceTitle: updated.source_title,
        draftTitle: updated.draft_title,
        status: updated.status
      });
    } catch (error) {
      failed.push({
        id: item.id,
        sourceTitle: item.source_title,
        error: error.message
      });
    }
  }

  printDatabaseInfo(store);
  console.log(JSON.stringify({
    mode: options.mock ? 'mock' : 'openai',
    draftedCount: drafted.length,
    failedCount: failed.length,
    drafted,
    failed,
    summary: await store.summarize()
  }, null, 2));
  await store.close();
}
