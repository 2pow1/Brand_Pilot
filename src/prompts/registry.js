import { buildInstagramChannelPrompt, buildInstagramSketchCardNewsPrompt } from '../channel/prompt.js';
import { INSTAGRAM_CHANNEL_RESPONSE_SCHEMA, INSTAGRAM_SKETCH_CARD_NEWS_RESPONSE_SCHEMA } from '../channel/schema.js';
import { buildDraftPrompt } from '../draft/prompt.js';
import { DRAFT_RESPONSE_SCHEMA } from '../draft/schema.js';
import { buildImagePrompt } from '../openai/image.js';

function freezeList(values = []) {
  return Object.freeze([...values]);
}

function promptSpec(spec) {
  return Object.freeze({
    ...spec,
    sourceFiles: freezeList(spec.sourceFiles),
    relatedFiles: freezeList(spec.relatedFiles),
    verification: freezeList(spec.verification)
  });
}

/**
 * Documents the GPT prompt entry points and their runtime contracts.
 *
 * This registry is discovery-first: it points maintainers to the prompt,
 * schema, post-processing, and verification surfaces without changing the
 * existing execution path.
 */
export const PROMPT_REGISTRY = Object.freeze({
  'draft.master.v1': promptSpec({
    id: 'draft.master.v1',
    title: 'Master draft generation',
    api: 'openai.responses',
    buildPrompt: buildDraftPrompt,
    schema: DRAFT_RESPONSE_SCHEMA,
    sourceFiles: ['src/draft/prompt.js', 'src/draft/schema.js', 'src/draft/openai.js'],
    relatedFiles: ['src/draft/index.js', 'test/draft.test.js'],
    verification: ['node --no-warnings=ExperimentalWarning --test test/draft.test.js']
  }),

  'instagram.card-news.v1': promptSpec({
    id: 'instagram.card-news.v1',
    title: 'Instagram card news adaptation',
    api: 'openai.responses',
    buildPrompt: buildInstagramChannelPrompt,
    schema: INSTAGRAM_CHANNEL_RESPONSE_SCHEMA,
    sourceFiles: ['src/channel/prompt.js', 'src/channel/schema.js', 'src/channel/openai.js'],
    relatedFiles: ['src/channel/instagram.js', 'test/channel-openai.test.js', 'test/channel.test.js'],
    verification: [
      'node --no-warnings=ExperimentalWarning --test test/channel-openai.test.js',
      'node --no-warnings=ExperimentalWarning --test test/channel.test.js'
    ]
  }),

  'instagram.sketch-card-news.v2': promptSpec({
    id: 'instagram.sketch-card-news.v2',
    title: 'Instagram sketch card news adaptation',
    api: 'openai.responses',
    buildPrompt: buildInstagramSketchCardNewsPrompt,
    schema: INSTAGRAM_SKETCH_CARD_NEWS_RESPONSE_SCHEMA,
    sourceFiles: ['src/channel/prompt.js', 'src/channel/schema.js', 'src/channel/openai.js'],
    relatedFiles: [
      'src/channel/instagram.js',
      'src/render/instagram-sketch.js',
      'scripts/preview-v2-cover-render.mjs',
      'test/channel-openai.test.js',
      'test/render.test.js'
    ],
    verification: [
      'node --no-warnings=ExperimentalWarning --test test/channel-openai.test.js',
      'node --no-warnings=ExperimentalWarning --test test/render.test.js',
      'node --no-warnings=ExperimentalWarning scripts/preview-v2-cover-render.mjs <content-id>'
    ]
  }),

  'instagram.cover-image.v1': promptSpec({
    id: 'instagram.cover-image.v1',
    title: 'Instagram cover image prompt constraints',
    api: 'openai.images',
    buildPrompt: buildImagePrompt,
    schema: null,
    sourceFiles: ['src/openai/image.js'],
    relatedFiles: [
      'src/channel/prompt.js',
      'src/render/instagram-sketch.js',
      'scripts/preview-v2-cover-render.mjs',
      'test/openai-image.test.js'
    ],
    verification: ['node --no-warnings=ExperimentalWarning --test test/openai-image.test.js']
  })
});

/**
 * Returns all known prompt specs in a stable order.
 */
export function listPromptSpecs() {
  return Object.values(PROMPT_REGISTRY);
}

/**
 * Returns one prompt spec by id, or null when the id is unknown.
 */
export function getPromptSpec(id) {
  return PROMPT_REGISTRY[id] || null;
}
