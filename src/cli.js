#!/usr/bin/env node

import { resolve } from 'node:path';
import { loadBrandConfig, loadConfig, loadJsonConfig } from './config.js';
import { openDatabaseStore } from './database/index.js';
import { fingerprint } from './ids.js';
import { CONTENT_STATUSES, contentTransitions } from './state.js';

/**
 * Prints the available CLI commands and arguments.
 */
function printUsage() {
  console.log(`Brand Pilot CLI

Usage:
  node src/cli.js init
  node src/cli.js status
  node src/cli.js sample
  node src/cli.js collect [--dry-run] [--limit <n>]
  node src/cli.js draft [--mock] [--limit <n>]
  node src/cli.js review check
  node src/cli.js review request [--mock] [--limit <n>]
  node src/cli.js review approve <content-id>
  node src/cli.js review reject <content-id> [reason]
  node src/cli.js channel generate [--limit <n>]
  node src/cli.js instagram render [--limit <n>]
  node src/cli.js instagram upload [--limit <n>]
  node src/cli.js instagram publish [--mock] [--limit <n>]
  node src/cli.js notion check
  node src/cli.js notion sync [--limit <n>]
  node src/cli.js notion backup [--limit <n>]
  node src/cli.js doctor [schedule|discord|publish|notion]
  node src/cli.js transitions
`);
}

/**
 * Parses shared boolean and limit options used by pipeline commands.
 */
function parseOptions(argv) {
  const options = {
    dryRun: false,
    mock: false,
    limit: 10
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--mock') {
      options.mock = true;
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

/**
 * Opens the configured app store and returns it with loaded runtime config.
 */
async function openAppDatabase() {
  const config = loadConfig();
  const store = await openDatabaseStore(config);
  return { store, config };
}

/**
 * Prints structured command output as formatted JSON.
 */
function printSummary(summary) {
  console.log(JSON.stringify(summary, null, 2));
}

/**
 * Prints which database provider and location are active for the current command.
 */
function printDatabaseInfo(store) {
  console.log(`Database provider: ${store.label}`);
  console.log(`Database: ${store.location}`);
}

/**
 * Initializes the configured database provider and verifies it can be opened.
 */
async function runInit() {
  const { store } = await openAppDatabase();
  printDatabaseInfo(store);
  await store.close();
}

/**
 * Prints the current pipeline state summary.
 */
async function runStatus() {
  const { store } = await openAppDatabase();
  printDatabaseInfo(store);
  printSummary(await store.summarize());
  await store.close();
}

/**
 * Creates a local sample content row and moves it to pending review for wiring tests.
 */
async function runSample() {
  const { createCollectedContent, transitionContent } = await import('./repository.js');
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

/**
 * Collects source candidates and optionally stores new ones in the configured database.
 */
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

/**
 * Creates common drafts for collected content using mock or OpenAI-backed generation.
 */
async function runDraft(argv) {
  const options = parseOptions(argv);
  const config = loadConfig();
  const brand = loadBrandConfig(config.cwd);
  const { createDraft } = await import('./draft/index.js');
  const { saveDraftForContent } = await import('./repository.js');
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

/**
 * Sends or mocks Discord review requests for draft_created content.
 */
async function runReviewRequest(argv) {
  const options = parseOptions(argv);
  const config = loadConfig();
  const { createReviewRequest } = await import('./review/index.js');
  const { requestReviewForContent } = await import('./repository.js');
  const { store } = await openAppDatabase();
  const items = await store.listContentItemsByStatus(CONTENT_STATUSES.DRAFT_CREATED, {
    limit: options.limit
  });
  const requested = [];
  const failed = [];

  for (const item of items) {
    try {
      const review = await createReviewRequest({
        config,
        item,
        mock: options.mock
      });
      const updated = await requestReviewForContent(store, item, review.messageId, {
        mode: options.mock ? 'mock' : 'discord',
        channelId: review.channelId,
        url: review.url
      });

      requested.push({
        id: updated.id,
        draftTitle: updated.draft_title,
        status: updated.status,
        reviewMessageId: updated.review_message_id,
        url: review.url
      });
    } catch (error) {
      failed.push({
        id: item.id,
        draftTitle: item.draft_title,
        error: error.message
      });
    }
  }

  printDatabaseInfo(store);
  console.log(JSON.stringify({
    mode: options.mock ? 'mock' : 'discord',
    requestedCount: requested.length,
    failedCount: failed.length,
    requested,
    failed,
    summary: await store.summarize()
  }, null, 2));
  await store.close();
}

/**
 * Checks whether the configured Discord bot can see the review channel.
 */
async function runReviewCheck() {
  const config = loadConfig();
  const { checkDiscordReviewTarget, formatDiscordReviewError } = await import('./review/discord.js');

  try {
    const result = await checkDiscordReviewTarget({ config });

    console.log(JSON.stringify({
      ok: true,
      botId: result.botId,
      botUsername: result.botUsername,
      channelId: result.channelId,
      guildId: result.guildId,
      channelName: result.channelName,
      channelType: result.channelType
    }, null, 2));
  } catch (error) {
    console.error(formatDiscordReviewError(error));
    process.exitCode = 1;
  }
}

/**
 * Applies a manual approval or rejection decision from the CLI.
 */
async function runReviewDecision(action, argv) {
  const contentId = argv[0];
  if (!contentId) {
    throw new Error(`content-id is required for review ${action}`);
  }

  const { approveContent, rejectContent } = await import('./repository.js');
  const { store } = await openAppDatabase();
  const item = await store.getContentItem(contentId);

  if (!item) {
    throw new Error(`Content item not found: ${contentId}`);
  }

  const updated =
    action === 'approve'
      ? await approveContent(store, item, { mode: 'manual-cli' })
      : await rejectContent(store, item, argv.slice(1).join(' ') || 'rejected', { mode: 'manual-cli' });

  printDatabaseInfo(store);
  console.log(JSON.stringify({
    id: updated.id,
    sourceTitle: updated.source_title,
    draftTitle: updated.draft_title,
    status: updated.status,
    summary: await store.summarize()
  }, null, 2));
  await store.close();
}

/**
 * Dispatches review subcommands.
 */
async function runReview(argv) {
  const action = argv[0];

  if (action === 'check') {
    await runReviewCheck();
  } else if (action === 'request') {
    await runReviewRequest(argv.slice(1));
  } else if (action === 'approve' || action === 'reject') {
    await runReviewDecision(action, argv.slice(1));
  } else {
    throw new Error('review command must be one of: check, request, approve, reject');
  }
}

/**
 * Generates channel-specific payloads for approved content items.
 */
async function runChannelGenerate(argv) {
  const options = parseOptions(argv);
  const config = loadConfig();
  const brand = loadBrandConfig(config.cwd);
  const channels = loadJsonConfig(resolve(config.cwd, 'config/channels.json'));
  const { generateChannelOutputs } = await import('./channel/index.js');
  const { saveChannelOutputsForContent } = await import('./repository.js');
  const { store } = await openAppDatabase();
  const items = await store.listContentItemsByStatus(CONTENT_STATUSES.APPROVED, {
    limit: options.limit
  });
  const generated = [];
  const failed = [];

  for (const item of items) {
    try {
      const outputs = generateChannelOutputs({
        brand,
        item,
        channels
      });

      const saved = await saveChannelOutputsForContent(store, item, outputs, {
        mode: 'template',
        channelIds: outputs.map((output) => output.channelId)
      });

      generated.push({
        id: saved.item.id,
        sourceTitle: saved.item.source_title,
        status: saved.item.status,
        channels: saved.outputs.map((output) => ({
          channelId: output.channel_id,
          status: output.status
        }))
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
    generatedCount: generated.length,
    failedCount: failed.length,
    generated,
    failed,
    summary: await store.summarize()
  }, null, 2));
  await store.close();
}

/**
 * Dispatches channel subcommands.
 */
async function runChannel(argv) {
  const action = argv[0];

  if (action === 'generate') {
    await runChannelGenerate(argv.slice(1));
  } else {
    throw new Error('channel command must be: generate');
  }
}

/**
 * Renders Instagram card-news payloads into local PNG artifacts.
 */
async function runInstagramRender(argv) {
  const options = parseOptions(argv);
  const config = loadConfig();
  const { renderInstagramCardNews } = await import('./render/instagram.js');
  const { markChannelOutputRendered } = await import('./repository.js');
  const { store } = await openAppDatabase();
  const rows = await store.listChannelOutputsReadyToRender({
    channelId: 'instagram',
    limit: options.limit
  });
  const rendered = [];
  const failed = [];

  for (const row of rows) {
    try {
      const payload = JSON.parse(row.channel_payload_json);
      const result = renderInstagramCardNews({
        cwd: config.cwd,
        contentItemId: row.id,
        payload
      });
      const saved = await markChannelOutputRendered(store, row, row, result.outputDir, {
        mode: 'powershell-system-drawing',
        slideCount: result.slides.length,
        manifestPath: result.manifestPath
      });

      rendered.push({
        id: saved.item.id,
        sourceTitle: saved.item.source_title,
        status: saved.item.status,
        channelId: saved.output.channel_id,
        channelStatus: saved.output.status,
        artifactPath: saved.output.artifact_path,
        slides: result.slides
      });
    } catch (error) {
      failed.push({
        id: row.id,
        sourceTitle: row.source_title,
        error: error.message
      });
    }
  }

  printDatabaseInfo(store);
  console.log(JSON.stringify({
    renderedCount: rendered.length,
    failedCount: failed.length,
    rendered,
    failed,
    summary: await store.summarize()
  }, null, 2));
  await store.close();
}

/**
 * Publishes ready Instagram artifacts through the Meta Graph API or mock publisher.
 */
async function runInstagramPublish(argv) {
  const options = parseOptions(argv);
  const config = loadConfig();
  const { createMockInstagramPublishResult, loadInstagramPublishInput, publishInstagramCardNews } = await import(
    './publish/instagram.js'
  );
  const { claimChannelOutputForPublish, markChannelOutputPublishFailed, markChannelOutputPublished } = await import(
    './repository.js'
  );
  const { store } = await openAppDatabase();
  const rows = await store.listChannelOutputsReadyToPublish({
    channelId: 'instagram',
    limit: options.limit
  });
  const published = [];
  const failed = [];
  const skipped = [];

  for (const row of rows) {
    const claimed = await claimChannelOutputForPublish(store, row, row, {
      mode: options.mock ? 'mock' : 'instagram-graph-api'
    });

    if (!claimed) {
      skipped.push({
        id: row.id,
        sourceTitle: row.source_title,
        reason: 'publish lock is held or retry backoff is active'
      });
      continue;
    }

    try {
      const payload = JSON.parse(row.channel_payload_json);
      const result = options.mock
        ? createMockInstagramPublishResult(row)
        : await publishInstagramCardNews({
            config,
            ...(await loadInstagramPublishInput({
              row,
              payload
            }))
          });
      const saved = await markChannelOutputPublished(store, row, row, result.publishedUrl, {
        mode: options.mock ? 'mock' : 'instagram-graph-api',
        mediaId: result.mediaId,
        containerId: result.containerId,
        childContainerIds: result.childContainerIds
      });

      published.push({
        id: saved.item.id,
        sourceTitle: saved.item.source_title,
        status: saved.item.status,
        channelId: saved.output.channel_id,
        channelStatus: saved.output.status,
        publishedUrl: saved.output.published_url
      });
    } catch (error) {
      const saved = await markChannelOutputPublishFailed(store, row, row, error.message, {
        mode: options.mock ? 'mock' : 'instagram-graph-api'
      });

      failed.push({
        id: row.id,
        sourceTitle: row.source_title,
        channelId: saved.output.channel_id,
        channelStatus: saved.output.status,
        attemptCount: saved.output.attempt_count,
        error: error.message
      });
    }
  }

  printDatabaseInfo(store);
  console.log(JSON.stringify({
    mode: options.mock ? 'mock' : 'instagram-graph-api',
    publishedCount: published.length,
    skippedCount: skipped.length,
    failedCount: failed.length,
    published,
    skipped,
    failed,
    summary: await store.summarize()
  }, null, 2));
  await store.close();
}

/**
 * Uploads rendered Instagram artifacts to Supabase Storage public URLs.
 */
async function runInstagramUpload(argv) {
  const options = parseOptions(argv);
  const config = loadConfig();
  const { uploadInstagramRenderArtifact } = await import('./storage/supabase.js');
  const { markChannelOutputUploaded } = await import('./repository.js');
  const { store } = await openAppDatabase();
  const rows = await store.listChannelOutputsReadyToPublish({
    channelId: 'instagram',
    limit: options.limit
  });
  const uploaded = [];
  const skipped = [];
  const failed = [];

  for (const row of rows) {
    try {
      const payload = JSON.parse(row.channel_payload_json);
      const result = await uploadInstagramRenderArtifact({
        config,
        row,
        payload
      });

      if (!result.uploaded) {
        skipped.push({
          id: row.id,
          sourceTitle: row.source_title,
          artifactPath: result.manifestPublicUrl,
          reason: 'already-public'
        });
        continue;
      }

      const saved = await markChannelOutputUploaded(store, row, row, result.manifestPublicUrl, {
        mode: 'supabase-storage',
        bucket: result.bucket,
        manifestObjectPath: result.manifestObjectPath,
        slideCount: result.slides.length
      });

      uploaded.push({
        id: saved.item.id,
        sourceTitle: saved.item.source_title,
        status: saved.item.status,
        channelId: saved.output.channel_id,
        channelStatus: saved.output.status,
        artifactPath: saved.output.artifact_path,
        slideCount: result.slides.length
      });
    } catch (error) {
      failed.push({
        id: row.id,
        sourceTitle: row.source_title,
        error: error.message
      });
    }
  }

  printDatabaseInfo(store);
  console.log(JSON.stringify({
    uploadedCount: uploaded.length,
    skippedCount: skipped.length,
    failedCount: failed.length,
    uploaded,
    skipped,
    failed,
    summary: await store.summarize()
  }, null, 2));
  await store.close();
}

/**
 * Dispatches Instagram subcommands.
 */
async function runInstagram(argv) {
  const action = argv[0];

  if (action === 'render') {
    await runInstagramRender(argv.slice(1));
  } else if (action === 'upload') {
    await runInstagramUpload(argv.slice(1));
  } else if (action === 'publish') {
    await runInstagramPublish(argv.slice(1));
  } else {
    throw new Error('instagram command must be one of: render, upload, publish');
  }
}

/**
 * Creates or updates Notion mirror pages for recent content items.
 */
async function runNotionSync(argv) {
  const options = parseOptions(argv);
  const config = loadConfig();
  const { syncContentItemToNotion } = await import('./notion/mirror.js');
  const { markContentNotionSynced } = await import('./repository.js');
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
  const { backupNotionArtifactsForItem } = await import('./notion/mirror.js');
  const { markChannelOutputNotionBackedUp, markChannelOutputNotionBackupFailed } = await import('./repository.js');
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
  const { checkNotionDataSource } = await import('./notion/mirror.js');
  const result = await checkNotionDataSource({ config });

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

/**
 * Dispatches Notion subcommands.
 */
async function runNotion(argv) {
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

/**
 * Prints the allowed content status transition table.
 */
function runTransitions() {
  console.log(JSON.stringify(contentTransitions(), null, 2));
}

/**
 * Runs configuration preflight checks for scheduled automation or publishing.
 */
async function runDoctor(argv) {
  const target = argv[0] || 'schedule';
  if (argv.length > 1) {
    throw new Error('doctor command accepts at most one target: schedule, discord, publish, or notion');
  }

  const config = loadConfig();
  const { buildDoctorReportWithRemoteChecks, formatDoctorReport } = await import('./doctor.js');
  const report = await buildDoctorReportWithRemoteChecks(config, target);

  console.log(formatDoctorReport(report));

  if (!report.ok) {
    process.exitCode = 1;
  }
}

const command = process.argv[2];
const args = process.argv.slice(3);

/**
 * Dispatches the top-level CLI command.
 */
async function main() {
  if (command === 'init') await runInit();
  else if (command === 'status') await runStatus();
  else if (command === 'sample') await runSample();
  else if (command === 'collect') await runCollect(args);
  else if (command === 'draft') await runDraft(args);
  else if (command === 'review') await runReview(args);
  else if (command === 'channel') await runChannel(args);
  else if (command === 'instagram') await runInstagram(args);
  else if (command === 'notion') await runNotion(args);
  else if (command === 'doctor') await runDoctor(args);
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
