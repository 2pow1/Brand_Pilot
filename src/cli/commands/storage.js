import { loadConfig } from '../../config.js';
import { markChannelOutputStorageCleaned } from '../../repository.js';
import { cleanupInstagramRenderArtifact } from '../../storage/supabase.js';
import { openAppDatabase } from '../database.js';
import { parseOptions } from '../options.js';
import { printDatabaseInfo } from '../output.js';

/**
 * Deletes backed-up Instagram artifact files from Supabase Storage after a safe dry-run by default.
 */
async function runStorageCleanup(argv) {
  const options = parseOptions(argv);
  if (options.confirm && options.dryRun) {
    throw new Error('Use either --confirm or --dry-run, not both');
  }

  const config = loadConfig();
  const { store } = await openAppDatabase();
  const rows = await store.listChannelOutputsReadyForStorageCleanup({
    channelId: 'instagram',
    limit: options.limit
  });
  const dryRun = !options.confirm;
  const candidates = [];
  const cleaned = [];
  const failed = [];

  for (const row of rows) {
    try {
      const result = await cleanupInstagramRenderArtifact({
        config,
        row,
        dryRun
      });

      if (dryRun) {
        candidates.push({
          id: row.id,
          sourceTitle: row.source_title,
          channelId: row.output_channel_id,
          channelStatus: row.channel_status,
          backupStatus: row.channel_backup_status,
          artifactPath: row.channel_artifact_path,
          objectCount: result.objectPaths.length,
          objectPaths: result.objectPaths
        });
        continue;
      }

      const saved = await markChannelOutputStorageCleaned(store, row, row, {
        mode: 'supabase-storage-cleanup',
        bucket: result.bucket,
        manifestUrl: result.manifestUrl,
        objectPaths: result.objectPaths,
        deletedCount: result.deletedCount
      });

      cleaned.push({
        id: saved.item.id,
        sourceTitle: saved.item.source_title,
        channelId: saved.output.channel_id,
        channelStatus: saved.output.status,
        artifactPath: saved.output.artifact_path,
        deletedCount: result.deletedCount
      });
    } catch (error) {
      failed.push({
        id: row.id,
        sourceTitle: row.source_title,
        channelId: row.output_channel_id,
        error: error.message
      });
    }
  }

  printDatabaseInfo(store);
  console.log(JSON.stringify({
    mode: dryRun ? 'dry-run' : 'confirmed',
    candidateCount: candidates.length,
    cleanedCount: cleaned.length,
    failedCount: failed.length,
    candidates,
    cleaned,
    failed,
    summary: await store.summarize()
  }, null, 2));
  await store.close();
}

/**
 * Dispatches Storage maintenance subcommands.
 */
export async function runStorage(argv) {
  const action = argv[0];

  if (action === 'cleanup') {
    await runStorageCleanup(argv.slice(1));
  } else {
    throw new Error('storage command must be: cleanup');
  }
}
