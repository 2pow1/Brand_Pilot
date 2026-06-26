import { buildFreeformCardNewsPrompt } from './prompt.js';

const sourceFiles = Object.freeze([
  'src/prompts/instagram/freeform-card-news-v3/index.js',
  'src/prompts/instagram/freeform-card-news-v3/prompt.js',
  'src/openai/response-image.js'
]);

const relatedFiles = Object.freeze([
  'scripts/preview-v3-freeform-card-news.mjs',
  'test/freeform-card-news-prompt.test.js',
  'test/openai-response-image.test.js'
]);

const verification = Object.freeze([
  'node --no-warnings=ExperimentalWarning --test test/freeform-card-news-prompt.test.js',
  'node --no-warnings=ExperimentalWarning --test test/openai-response-image.test.js'
]);

export const INSTAGRAM_FREEFORM_CARD_NEWS_V3_PROMPT_SPEC = Object.freeze({
  id: 'instagram.freeform-card-news.v3',
  title: 'Instagram freeform image card news preview',
  api: 'openai.responses.image_generation',
  buildPrompt: buildFreeformCardNewsPrompt,
  schema: null,
  sourceFiles,
  relatedFiles,
  verification
});
