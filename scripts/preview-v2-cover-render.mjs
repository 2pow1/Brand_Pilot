import { loadBrandConfig, loadChannelConfig, loadConfig } from '../src/config.js';
import { createInstagramSketchCardNewsPayload } from '../src/channel/instagram.js';
import { createOpenAiInstagramCardNewsPayload } from '../src/channel/openai.js';
import { openDatabaseStore } from '../src/database/index.js';
import { renderInstagramCardNews } from '../src/render/instagram.js';
import { INSTAGRAM_SKETCH_CARD_NEWS_TEMPLATE } from '../src/render/instagram-sketch.js';
import { CONTENT_STATUSES } from '../src/state.js';

const READABLE_STATUSES = [
  CONTENT_STATUSES.PENDING_REVIEW,
  CONTENT_STATUSES.DRAFT_CREATED,
  CONTENT_STATUSES.APPROVED,
  CONTENT_STATUSES.CHANNEL_GENERATED,
  CONTENT_STATUSES.PUBLISH_PENDING,
  CONTENT_STATUSES.PUBLISHED
];

function printUsage() {
  console.log(`Read-only v2 cover preview

Usage:
  node --no-warnings=ExperimentalWarning scripts/preview-v2-cover-render.mjs [content-id] [--mock] [--no-cover-image]

Options:
  --mock            Skip GPT channel adaptation and use the deterministic v2 template payload.
  --no-cover-image  Skip OpenAI Image API generation and render with the plain template background.
  --help           Show this help.

This script reads one drafted content item from the configured DB, generates a v2 Instagram
payload, renders local PNG files, and does not write pipeline state, channel_outputs,
Supabase Storage, Notion, or Instagram.
`);
}

function parseArgs(argv) {
  const options = {
    contentId: '',
    mock: false,
    coverImage: true,
    help: false
  };

  for (const arg of argv) {
    if (arg === '--mock') {
      options.mock = true;
    } else if (arg === '--no-cover-image') {
      options.coverImage = false;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!options.contentId) {
      options.contentId = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return options;
}

function assertDraftReady(item) {
  if (!item) {
    throw new Error('No content item found. Pass a content ID or create a drafted review item first.');
  }

  if (!item.draft_title || !item.draft_body) {
    throw new Error(
      `Content item is not draft-ready: ${item.id}. Run draft generation first, then rerun this preview.`
    );
  }
}

async function findPreviewItem(store, contentId) {
  if (contentId) {
    return store.getContentItem(contentId);
  }

  for (const status of READABLE_STATUSES) {
    const items = await store.listContentItemsByStatus(status, { limit: 10 });
    const item = items.find((candidate) => candidate.draft_title && candidate.draft_body);
    if (item) return item;
  }

  return null;
}

function loadInstagramSketchChannel(config) {
  const channels = loadChannelConfig(config.cwd, {
    ...config,
    instagramTemplate: INSTAGRAM_SKETCH_CARD_NEWS_TEMPLATE
  });
  const channel = channels.find((candidate) => candidate.id === 'instagram');

  if (!channel) {
    throw new Error('Instagram channel not found in config/channels.json.');
  }

  return {
    ...channel,
    enabled: true,
    template: INSTAGRAM_SKETCH_CARD_NEWS_TEMPLATE
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const config = loadConfig();
  const previewConfig = {
    ...config,
    instagramTemplate: INSTAGRAM_SKETCH_CARD_NEWS_TEMPLATE,
    instagramCoverImageEnabled: options.coverImage
  };

  if (!options.mock && !previewConfig.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required for GPT channel adaptation. Use --mock to skip it.');
  }

  if (options.coverImage && !previewConfig.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required for cover image generation. Use --no-cover-image to skip it.');
  }

  const brand = loadBrandConfig(previewConfig.cwd);
  const channel = loadInstagramSketchChannel(previewConfig);
  const store = await openDatabaseStore(previewConfig);

  try {
    const item = await findPreviewItem(store, options.contentId);
    assertDraftReady(item);

    const payload = options.mock
      ? createInstagramSketchCardNewsPayload({ brand, item, channel })
      : await createOpenAiInstagramCardNewsPayload({
          config: previewConfig,
          brand,
          item,
          channel
        });

    const contentItemId = `preview_${item.id}_v2_cover`;
    const result = await renderInstagramCardNews({
      cwd: previewConfig.cwd,
      contentItemId,
      payload,
      config: previewConfig
    });

    console.log(JSON.stringify({
      mode: 'read-only-v2-cover-preview',
      database: {
        provider: store.label,
        location: store.location
      },
      dbMutated: false,
      mock: options.mock,
      coverImageEnabled: options.coverImage,
      item: {
        id: item.id,
        status: item.status,
        sourceTitle: item.source_title,
        draftTitle: item.draft_title
      },
      template: payload.template,
      coverImagePrompt: payload.coverImagePrompt,
      outputDir: result.outputDir,
      manifestPath: result.manifestPath,
      slideCount: result.slides.length,
      slides: result.slides
    }, null, 2));
  } finally {
    await store.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
