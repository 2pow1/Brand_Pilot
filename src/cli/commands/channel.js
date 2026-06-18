import { loadBrandConfig, loadChannelConfig, loadConfig } from '../../config.js';
import { generateChannelOutputs } from '../../channel/index.js';
import { regenerateChannelOutputsForContent, saveChannelOutputsForContent } from '../../repository.js';
import { CONTENT_STATUSES } from '../../state.js';
import { openAppDatabase } from '../database.js';
import { parseOptions } from '../options.js';
import { printDatabaseInfo } from '../output.js';

/**
 * Generates channel-specific payloads for approved content items.
 */
async function runChannelGenerate(argv) {
  const options = parseOptions(argv);
  const config = loadConfig();
  const brand = loadBrandConfig(config.cwd);
  const channels = loadChannelConfig(config.cwd, config);
  const { store } = await openAppDatabase();
  const items = await store.listContentItemsByStatus(CONTENT_STATUSES.APPROVED, {
    limit: options.limit
  });
  const generated = [];
  const failed = [];

  for (const item of items) {
    try {
      const outputs = await generateChannelOutputs({
        config,
        brand,
        item,
        channels,
        mock: options.mock
      });

      const saved = await saveChannelOutputsForContent(store, item, outputs, {
        mode: options.mock ? 'template' : 'openai-channel',
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
 * Rebuilds channel-specific payloads for one in-flight content item.
 */
async function runChannelRegenerate(argv) {
  const contentId = argv[0];
  if (!contentId) {
    throw new Error('channel regenerate requires <content-id>');
  }
  const options = parseOptions(argv.slice(1));

  const config = loadConfig();
  const brand = loadBrandConfig(config.cwd);
  const channels = loadChannelConfig(config.cwd, config);
  const { store } = await openAppDatabase();
  const item = await store.getContentItem(contentId);

  if (!item) {
    throw new Error(`Content item not found: ${contentId}`);
  }

  const outputs = await generateChannelOutputs({
    config,
    brand,
    item,
    channels,
    mock: options.mock
  });
  const saved = await regenerateChannelOutputsForContent(store, item, outputs, {
    mode: options.mock ? 'template-regenerate' : 'openai-channel-regenerate',
    channelIds: outputs.map((output) => output.channelId)
  });

  printDatabaseInfo(store);
  console.log(JSON.stringify({
    regeneratedCount: saved.outputs.length,
    regenerated: {
      id: saved.item.id,
      sourceTitle: saved.item.source_title,
      previousStatus: item.status,
      status: saved.item.status,
      channels: saved.outputs.map((output) => ({
        channelId: output.channel_id,
        status: output.status
      }))
    },
    summary: await store.summarize()
  }, null, 2));
  await store.close();
}

/**
 * Dispatches channel subcommands.
 */
export async function runChannel(argv) {
  const action = argv[0];

  if (action === 'generate') {
    await runChannelGenerate(argv.slice(1));
  } else if (action === 'regenerate') {
    await runChannelRegenerate(argv.slice(1));
  } else {
    throw new Error('channel command must be one of: generate, regenerate');
  }
}
