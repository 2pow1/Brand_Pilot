import { buildInstagramSketchCardNewsPrompt } from './prompt.js';
import { INSTAGRAM_SKETCH_CARD_NEWS_RESPONSE_SCHEMA } from './schema.js';
import {
  classifySketchContentFit,
  classifySketchTitleFit,
  joinShortBodyLines,
  normalizeSketchText,
  SKETCH_CONTENT_BUDGETS,
  SKETCH_CONTENT_FIELDS,
  SKETCH_TITLE_BUDGETS,
  SKETCH_TITLE_FIELDS
} from './text-fit-policy.js';

const sourceFiles = Object.freeze([
  'src/prompts/instagram/sketch-card-news-v2/index.js',
  'src/prompts/instagram/sketch-card-news-v2/prompt.js',
  'src/prompts/instagram/sketch-card-news-v2/schema.js',
  'src/prompts/instagram/sketch-card-news-v2/text-fit-policy.js'
]);

const relatedFiles = Object.freeze([
  'src/openai/responses.js',
  'src/channel/openai.js',
  'src/channel/instagram.js',
  'src/render/instagram-sketch.js',
  'scripts/preview-v2-cover-render.mjs',
  'test/channel-openai.test.js',
  'test/channel.test.js',
  'test/openai-responses.test.js',
  'test/render.test.js'
]);

const verification = Object.freeze([
  'node --no-warnings=ExperimentalWarning --test test/channel-openai.test.js',
  'node --no-warnings=ExperimentalWarning --test test/channel.test.js',
  'node --no-warnings=ExperimentalWarning --test test/render.test.js',
  'node --no-warnings=ExperimentalWarning scripts/preview-v2-cover-render.mjs <content-id>'
]);

export const INSTAGRAM_SKETCH_CARD_NEWS_PROMPT_SPEC = Object.freeze({
  id: 'instagram.sketch-card-news.v2',
  title: 'Instagram sketch card news adaptation',
  api: 'openai.responses',
  responseName: 'brand_pilot_instagram_sketch_channel',
  buildPrompt: buildInstagramSketchCardNewsPrompt,
  schema: INSTAGRAM_SKETCH_CARD_NEWS_RESPONSE_SCHEMA,
  textFitPolicy: Object.freeze({
    normalizeSketchText,
    joinShortBodyLines,
    classifySketchTitleFit,
    classifySketchContentFit,
    titleFields: SKETCH_TITLE_FIELDS,
    titleBudgets: SKETCH_TITLE_BUDGETS,
    contentFields: SKETCH_CONTENT_FIELDS,
    contentBudgets: SKETCH_CONTENT_BUDGETS
  }),
  sourceFiles,
  relatedFiles,
  verification
});

export { buildInstagramSketchCardNewsPrompt } from './prompt.js';
export { INSTAGRAM_SKETCH_CARD_NEWS_RESPONSE_SCHEMA } from './schema.js';
export {
  classifySketchContentFit,
  classifySketchTitleFit,
  joinShortBodyLines,
  normalizeSketchText,
  SKETCH_CONTENT_BUDGETS,
  SKETCH_CONTENT_FIELDS,
  SKETCH_TITLE_BUDGETS,
  SKETCH_TITLE_FIELDS
} from './text-fit-policy.js';
