import { loadBrandConfig, loadConfig } from '../../config.js';
import {
  createMockInstagramPublishResult,
  loadInstagramPublishInput,
  publishInstagramCardNews
} from '../../publish/instagram.js';
import {
  claimChannelOutputForPublish,
  markChannelOutputPublishFailed,
  markChannelOutputPublished,
  markChannelOutputRendered,
  markChannelOutputUploaded
} from '../../repository.js';
import { renderInstagramCardNews } from '../../render/instagram.js';
import { createInstagramSketchPreviewPayload } from '../../render/instagram-preview.js';
import { uploadInstagramRenderArtifact } from '../../storage/supabase.js';
import { openAppDatabase } from '../database.js';
import { parseOptions } from '../options.js';
import { printDatabaseInfo } from '../output.js';

/**
 * Renders a deterministic v2 sample without reading or mutating pipeline state.
 */
async function runInstagramPreviewSketch(argv) {
  if (argv.length > 0) {
    throw new Error('instagram preview-sketch does not accept options');
  }

  const config = loadConfig();
  const brand = loadBrandConfig(config.cwd);
  const payload = createInstagramSketchPreviewPayload({ brand });
  const result = await renderInstagramCardNews({
    cwd: config.cwd,
    contentItemId: 'preview_instagram_sketch_v2',
    payload,
    config: {
      ...config,
      instagramCoverImageEnabled: false
    }
  });

  console.log(JSON.stringify({
    mode: 'preview-sketch',
    template: payload.template,
    coverImageEnabled: false,
    outputDir: result.outputDir,
    manifestPath: result.manifestPath,
    slideCount: result.slides.length,
    slides: result.slides
  }, null, 2));
}

/**
 * Renders Instagram card-news payloads into local PNG artifacts.
 */
async function runInstagramRender(argv) {
  const options = parseOptions(argv);
  const config = loadConfig();
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
      const result = await renderInstagramCardNews({
        cwd: config.cwd,
        contentItemId: row.id,
        payload,
        config
      });
      const saved = await markChannelOutputRendered(store, row, row, result.outputDir, {
        mode: result.mode || 'renderer',
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
export async function runInstagram(argv) {
  const action = argv[0];

  if (action === 'preview-sketch') {
    await runInstagramPreviewSketch(argv.slice(1));
  } else if (action === 'render') {
    await runInstagramRender(argv.slice(1));
  } else if (action === 'upload') {
    await runInstagramUpload(argv.slice(1));
  } else if (action === 'publish') {
    await runInstagramPublish(argv.slice(1));
  } else {
    throw new Error('instagram command must be one of: preview-sketch, render, upload, publish');
  }
}
