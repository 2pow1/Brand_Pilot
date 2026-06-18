import { loadConfig } from '../../config.js';
import {
  backupNotionArtifactsForItem,
  checkNotionDataSource,
  syncContentItemToNotion
} from '../../notion/mirror.js';
import {
  markChannelOutputNotionBackedUp,
  markChannelOutputNotionBackupFailed,
  markContentNotionSynced
} from '../../repository.js';
import { openAppDatabase } from '../database.js';
import { parseOptions } from '../options.js';
import { printDatabaseInfo } from '../output.js';

/**
 * Creates or updates Notion mirror pages for recent content items.
 */
async function runNotionSync(argv) {
  const options = parseOptions(argv);
  const config = loadConfig();
  const { store } = await openAppDatabase();
  const items = await store.listContentItemsForNotionSync({
    limit: options.limit
  });
  const synced = [];
  const failed = [];

  for (const item of items) {
    try {
      const result = await syncContentItemToNotion({
        config,
        item
      });
      const updated = await markContentNotionSynced(store, item, result.pageId, {
        mode: 'notion-api',
        action: result.action,
        url: result.url
      });

      synced.push({
        id: updated.id,
        sourceTitle: updated.source_title,
        status: updated.status,
        notionPageId: updated.notion_page_id,
        action: result.action,
        url: result.url
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
    syncedCount: synced.length,
    failedCount: failed.length,
    synced,
    failed,
    summary: await store.summarize()
  }, null, 2));
  await store.close();
}

/**
 * Imports public Instagram artifacts into Notion-hosted files after the page mirror exists.
 */
async function runNotionBackup(argv) {
  const options = parseOptions(argv);
  const config = loadConfig();
  const { store } = await openAppDatabase();
  const rows = await store.listChannelOutputsReadyForNotionBackup({
    channelId: 'instagram',
    limit: options.limit
  });
  const backedUp = [];
  const failed = [];

  for (const row of rows) {
    try {
      const result = await backupNotionArtifactsForItem({
        config,
        item: row
      });
      const saved = await markChannelOutputNotionBackedUp(store, row, row, {
        pageId: result.pageId,
        url: result.url,
        manifestUrl: result.manifestUrl,
        backedUpAt: result.backedUpAt,
        files: result.files
      });

      backedUp.push({
        id: row.id,
        sourceTitle: row.source_title,
        channelId: saved.output.channel_id,
        backupStatus: saved.output.backup_status,
        backupCompletedAt: saved.output.backup_completed_at,
        fileCount: result.files.length,
        notionPageId: result.pageId,
        url: result.url
      });
    } catch (error) {
      const saved = await markChannelOutputNotionBackupFailed(store, row, row, error.message, {
        artifactPath: row.channel_artifact_path
      });

      failed.push({
        id: row.id,
        sourceTitle: row.source_title,
        channelId: saved.output.channel_id,
        backupStatus: saved.output.backup_status,
        error: error.message
      });
    }
  }

  printDatabaseInfo(store);
  console.log(JSON.stringify({
    backedUpCount: backedUp.length,
    failedCount: failed.length,
    backedUp,
    failed,
    summary: await store.summarize()
  }, null, 2));
  await store.close();
}

/**
 * Verifies that the configured Notion data source has the required mirror properties.
 */
async function runNotionCheck() {
  const config = loadConfig();
  const result = await checkNotionDataSource({ config });

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

/**
 * Dispatches Notion subcommands.
 */
export async function runNotion(argv) {
  const action = argv[0];

  if (action === 'check') {
    await runNotionCheck();
  } else if (action === 'sync') {
    await runNotionSync(argv.slice(1));
  } else if (action === 'backup') {
    await runNotionBackup(argv.slice(1));
  } else {
    throw new Error('notion command must be one of: check, sync, backup');
  }
}
