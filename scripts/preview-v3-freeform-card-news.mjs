import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { loadBrandConfig, loadConfig } from '../src/config.js';
import { openDatabaseStore } from '../src/database/index.js';
import { generateOpenAiResponseImages } from '../src/openai/response-image.js';
import {
  buildFreeformCardNewsPrompt,
  buildFreeformInputTextFromItem
} from '../src/prompts/instagram/freeform-card-news-v3/prompt.js';
import { CONTENT_STATUSES } from '../src/state.js';

const DEFAULT_CARD_COUNT = 3;
const MODE = 'v3-freeform-card-news-preview';
const PROMPT_VERSION = 'client-card-news-v1';
const READABLE_STATUSES = [
  CONTENT_STATUSES.PENDING_REVIEW,
  CONTENT_STATUSES.DRAFT_CREATED,
  CONTENT_STATUSES.APPROVED,
  CONTENT_STATUSES.CHANNEL_GENERATED,
  CONTENT_STATUSES.PUBLISH_PENDING,
  CONTENT_STATUSES.PUBLISHED
];

function printUsage() {
  console.log(`Read-only v3 freeform card-news image preview

Usage:
  node --no-warnings=ExperimentalWarning scripts/preview-v3-freeform-card-news.mjs [content-id] [options]

Options:
  --cards <count>       Requested card count in the prompt. Default: ${DEFAULT_CARD_COUNT}.
  --model <model>       Responses API model. Default: OPENAI_V3_FREEFORM_MODEL or OPENAI_MODEL.
  --input-file <path>   Use a local text file instead of a content item from the configured DB.
  --output-dir <path>   Write preview artifacts to a custom directory.
  --dry-run             Write prompt.txt and manifest.json without calling OpenAI.
  --help                Show this help.

This script reads one content item or input file, applies the client freeform card-news
prompt, asks the Responses API image_generation tool to create finished card images,
and writes local PNG files. It does not write pipeline state, channel_outputs,
Supabase Storage, Notion, or Instagram.
`);
}

function readOptionValue(argv, index, name) {
  const next = argv[index + 1];
  if (!next || next.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return next;
}

function parseArgs(argv) {
  const options = {
    contentId: '',
    cardCount: DEFAULT_CARD_COUNT,
    model: '',
    inputFile: '',
    outputDir: '',
    dryRun: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--cards') {
      options.cardCount = readOptionValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith('--cards=')) {
      options.cardCount = arg.slice('--cards='.length);
    } else if (arg === '--model') {
      options.model = readOptionValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith('--model=')) {
      options.model = arg.slice('--model='.length);
    } else if (arg === '--input-file') {
      options.inputFile = readOptionValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith('--input-file=')) {
      options.inputFile = arg.slice('--input-file='.length);
    } else if (arg === '--output-dir') {
      options.outputDir = readOptionValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith('--output-dir=')) {
      options.outputDir = arg.slice('--output-dir='.length);
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!options.contentId) {
      options.contentId = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (options.contentId && options.inputFile) {
    throw new Error('Use either a content ID or --input-file, not both.');
  }

  return options;
}

function normalizeCardCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error('--cards must be a positive integer.');
  }
  return Math.min(parsed, 10);
}

function safePathSegment(value) {
  return (
    String(value || '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'input'
  );
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assertPreviewReady(item) {
  if (!item) {
    throw new Error('No content item found. Pass a content ID, --input-file, or create a drafted review item first.');
  }

  if (!buildFreeformInputTextFromItem(item)) {
    throw new Error(`Content item has no usable text: ${item.id}`);
  }
}

async function findPreviewItem(store, contentId) {
  if (contentId) {
    return store.getContentItem(contentId);
  }

  for (const status of READABLE_STATUSES) {
    const items = await store.listContentItemsByStatus(status, { limit: 10 });
    const item = items.find((candidate) => buildFreeformInputTextFromItem(candidate));
    if (item) return item;
  }

  return null;
}

async function loadPreviewSource(config, options) {
  if (options.inputFile) {
    const inputPath = resolve(config.cwd, options.inputFile);
    return {
      source: {
        type: 'input-file',
        path: inputPath,
        name: basename(inputPath)
      },
      inputText: readFileSync(inputPath, 'utf8'),
      outputId: `preview_${safePathSegment(basename(inputPath))}_v3_freeform_card_news`
    };
  }

  const store = await openDatabaseStore(config);
  try {
    const item = await findPreviewItem(store, options.contentId);
    assertPreviewReady(item);

    return {
      source: {
        type: 'database',
        database: {
          provider: store.label,
          location: store.location
        },
        item: {
          id: item.id,
          status: item.status,
          sourceTitle: item.source_title,
          draftTitle: item.draft_title
        }
      },
      item,
      outputId: `preview_${item.id}_v3_freeform_card_news`
    };
  } finally {
    await store.close();
  }
}

function buildManifest({
  dryRun,
  source,
  model,
  cardCount,
  outputDir,
  promptPath,
  generation = null
}) {
  return {
    mode: MODE,
    promptVersion: PROMPT_VERSION,
    dryRun,
    generatedAt: new Date().toISOString(),
    source,
    model,
    requestedCardCount: cardCount,
    outputDir,
    promptPath,
    responseId: generation?.responseId || '',
    requestId: generation?.requestId || '',
    clientRequestId: generation?.clientRequestId || '',
    outputText: generation?.outputText || '',
    outputTypes: generation?.outputTypes || [],
    usage: generation?.usage || null,
    slides: (generation?.images || []).map((image) => image.outputPath)
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const config = loadConfig();
  const brand = loadBrandConfig(config.cwd);
  const source = await loadPreviewSource(config, options);
  const cardCount = normalizeCardCount(options.cardCount);
  const model = options.model || process.env.OPENAI_V3_FREEFORM_MODEL || config.openaiModel;
  const outputDir = resolve(
    config.cwd,
    options.outputDir || join('artifacts', 'generated', 'instagram', source.outputId)
  );
  const promptPath = join(outputDir, 'prompt.txt');
  const manifestPath = join(outputDir, 'manifest.json');
  const prompt = buildFreeformCardNewsPrompt({
    brand,
    item: source.item,
    inputText: source.inputText,
    cardCount
  });

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(promptPath, prompt, 'utf8');

  if (options.dryRun) {
    const manifest = buildManifest({
      dryRun: true,
      source: source.source,
      model,
      cardCount,
      outputDir,
      promptPath
    });
    writeJson(manifestPath, manifest);

    console.log(JSON.stringify({
      mode: MODE,
      dryRun: true,
      promptVersion: PROMPT_VERSION,
      model,
      requestedCardCount: cardCount,
      outputDir,
      promptPath,
      manifestPath
    }, null, 2));
    return;
  }

  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required for v3 freeform preview. Use --dry-run to inspect the prompt only.');
  }

  const generation = await generateOpenAiResponseImages({
    config: {
      ...config,
      openaiModel: model
    },
    prompt,
    outputDir
  });
  const manifest = buildManifest({
    dryRun: false,
    source: source.source,
    model,
    cardCount,
    outputDir,
    promptPath,
    generation
  });
  writeJson(manifestPath, manifest);

  console.log(JSON.stringify({
    mode: MODE,
    dryRun: false,
    promptVersion: PROMPT_VERSION,
    model,
    requestedCardCount: cardCount,
    generatedImageCount: generation.images.length,
    outputDir,
    promptPath,
    manifestPath,
    slides: generation.images.map((image) => image.outputPath)
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

