import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateOpenAiImage } from '../openai/image.js';

export const INSTAGRAM_SKETCH_CARD_NEWS_TEMPLATE = 'instagram-sketch-card-news-v2';

/**
 * Escapes text before inserting model output into the renderer document.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Preserves intentional line breaks while keeping HTML injection out.
 */
function multiline(value) {
  return escapeHtml(value).replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
}

/**
 * Normalizes optional string fields for renderer decisions.
 */
function text(value) {
  return String(value ?? '').trim();
}

function inlineVisibleLength(value) {
  return Array.from(String(value ?? '').replace(/\s+/g, '')).length;
}

function joinShortBodyLines(value, maxLineLength = 18) {
  const normalized = text(value)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
  if (!normalized) return normalized;

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const joined = [];

      for (const line of lines) {
        const previous = joined.at(-1);
        const combined = previous ? `${previous} ${line}` : line;
        if (previous && inlineVisibleLength(combined) <= maxLineLength) {
          joined[joined.length - 1] = combined;
        } else {
          joined.push(line);
        }
      }

      return joined.join('\n');
    })
    .join('\n\n')
    .trim();
}

const TITLE_FIT_LEVELS = new Set(['normal', 'tight', 'compressed']);
const TITLE_FIELDS_BY_LAYOUT = Object.freeze({
  '02': 'question'
});
const CONTENT_FIT_LEVELS = new Set(['normal', 'tight', 'compressed']);
const CONTENT_FIELDS_BY_LAYOUT = Object.freeze({
  '02': ['answer'],
  '03': ['problem', 'solution'],
  '04': ['steps'],
  '05': ['items'],
  '06': ['before', 'after'],
  '07': ['description'],
  '08': ['items'],
  '09': ['description', 'cta']
});
const CONTENT_FIT_RULES = Object.freeze({
  '03': { normal: 95, tight: 130, normalLines: 8, tightLines: 11, maxLineLength: 18, compressedLineMinLength: 95 },
  '06': { normal: 95, tight: 120, normalLines: 7, tightLines: 9, maxLineLength: 17, compressedLineMinLength: 95 },
  default: { normal: 105, tight: 145, normalLines: 8, tightLines: 12, maxLineLength: 18, compressedLineMinLength: 105 }
});

function visibleCharacterCount(value) {
  return inlineVisibleLength(text(value));
}

function inferTitleFitLevel(card) {
  const field = TITLE_FIELDS_BY_LAYOUT[card.layout] || 'title';
  const title = text(card[field]);
  const lineCount = title ? title.split(/\r?\n/).filter(Boolean).length : 0;
  const length = visibleCharacterCount(title);
  const maxLineLength = Math.max(0, ...title.split(/\r?\n/).map(visibleCharacterCount));

  if (length > 36 || maxLineLength > 22 || lineCount > 3) return 'compressed';
  if (length > 26 || maxLineLength > 16 || lineCount > 2) return 'tight';
  return 'normal';
}

function titleFitLevel(card) {
  const level = text(card.titleFit?.level);
  return TITLE_FIT_LEVELS.has(level) ? level : inferTitleFitLevel(card);
}

function textParts(value) {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textParts);
  if (typeof value === 'object') return Object.values(value).flatMap(textParts);
  return [];
}

function inferContentFitLevel(card) {
  const rule = CONTENT_FIT_RULES[card.layout] || CONTENT_FIT_RULES.default;
  const fields = CONTENT_FIELDS_BY_LAYOUT[card.layout] || [];
  const lines = fields
    .flatMap((field) => textParts(card[field]))
    .flatMap((value) => joinShortBodyLines(value).split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);
  const length = visibleCharacterCount(lines.join('\n'));
  const estimatedLineCount = lines.reduce(
    (sum, line) => sum + Math.max(1, Math.ceil(visibleCharacterCount(line) / rule.maxLineLength)),
    0
  );
  const maxLineLength = Math.max(0, ...lines.map(visibleCharacterCount));
  const lineOverflowIsDense =
    estimatedLineCount > rule.tightLines &&
    length > (rule.compressedLineMinLength ?? rule.normal);

  if (
    length > rule.tight ||
    lineOverflowIsDense ||
    maxLineLength > rule.maxLineLength + 8
  ) {
    return 'compressed';
  }

  if (
    length > rule.normal ||
    estimatedLineCount > rule.normalLines ||
    maxLineLength > rule.maxLineLength
  ) {
    return 'tight';
  }

  return 'normal';
}

function contentFitLevel(card) {
  const level = text(card.contentFit?.level);
  return CONTENT_FIT_LEVELS.has(level) ? level : inferContentFitLevel(card);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripLeadingSectionLabel(value, labels) {
  const normalized = text(value)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
  const choices = labels.map(text).filter(Boolean);
  if (!normalized || choices.length === 0) return normalized;

  const pattern = new RegExp(
    `^(?:${choices.map(escapeRegExp).join('|')})(?:\\s*[:：\\-–—]\\s*|\\s*\\n+)`,
    'i'
  );

  return normalized.replace(pattern, '').trim();
}

/**
 * Chooses a browser-supported MIME type for local static image embedding.
 */
function imageMimeType(path) {
  const extension = extname(path).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  return 'image/png';
}

/**
 * Embeds a local image as a data URL so Playwright setContent can render it reliably.
 */
function localImageDataUrl(path) {
  return `data:${imageMimeType(path)};base64,${readFileSync(path).toString('base64')}`;
}

/**
 * Converts a local or remote image reference into a CSS url() value.
 */
export function toCssImageUrl({ cwd, value }) {
  const raw = text(value);
  if (!raw) return '';

  const url = /^https?:\/\//i.test(raw) || raw.startsWith('data:')
    ? raw
    : pathToFileURL(isAbsolute(raw) ? raw : resolve(cwd, raw)).href;

  return `url("${url.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}")`;
}

/**
 * Finds the optional cover background image generated by a later image step.
 */
export function resolveCoverImage({ cwd, payload }) {
  const value =
    payload.coverImageUrl ||
    payload.coverImagePath ||
    payload.coverImage?.url ||
    payload.coverImage?.path ||
    '';
  const raw = text(value);
  if (!raw) return '';

  if (!/^https?:\/\//i.test(raw) && !raw.startsWith('data:')) {
    const imagePath = isAbsolute(raw) ? raw : resolve(cwd, raw);
    if (existsSync(imagePath)) {
      return toCssImageUrl({
        cwd,
        value: localImageDataUrl(imagePath)
      });
    }
  }

  return toCssImageUrl({
    cwd,
    value: raw
  });
}

/**
 * Adds a static image renderer marker to the final CTA card when configured.
 */
export function applyStaticFinalCtaCard({ cwd, payload, config = {} }) {
  const sourcePath = text(config.instagramFinalCtaImagePath);
  if (!sourcePath) return payload;

  const imagePath = isAbsolute(sourcePath) ? sourcePath : resolve(cwd, sourcePath);
  if (!existsSync(imagePath)) {
    throw new Error(`INSTAGRAM_FINAL_CTA_IMAGE_PATH does not exist: ${sourcePath}`);
  }

  const cards = Array.isArray(payload.cards) ? payload.cards : [];
  if (cards.length === 0) return payload;

  return {
    ...payload,
    finalCtaImage: {
      path: imagePath,
      source: sourcePath
    },
    cards: cards.map((card, index) =>
      index === cards.length - 1
        ? {
            ...card,
            index: index + 1,
            page: `${index + 1}/${cards.length}`,
            staticImagePath: imagePath,
            staticImageSource: sourcePath,
            staticImageDataUrl: localImageDataUrl(imagePath)
          }
        : {
            ...card,
            index: index + 1,
            page: `${index + 1}/${cards.length}`
          }
    )
  };
}

/**
 * Generates a cover background image only when the feature is explicitly enabled.
 */
export async function prepareCoverImage({ config = {}, outputDir, payload, fetchImpl = fetch }) {
  if (!config.instagramCoverImageEnabled) return payload;
  if (resolveCoverImage({ cwd: config.cwd || process.cwd(), payload })) return payload;
  if (!text(payload.coverImagePrompt)) return payload;

  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, 'cover-background.png');
  const image = await generateOpenAiImage({
    config,
    prompt: payload.coverImagePrompt,
    outputPath,
    fetchImpl
  });

  return {
    ...payload,
    coverImagePath: outputPath,
    coverImage: {
      status: 'generated',
      path: outputPath,
      model: image.model,
      size: image.size,
      quality: image.quality,
      source: image.source,
      prompt: payload.coverImagePrompt,
      generatedPrompt: image.prompt,
      usage: image.usage
    }
  };
}

/**
 * Renders a numbered list for card layouts that carry repeated items.
 */
function renderList(items = []) {
  return `
    <div class="item-list">
      ${items
        .map((item, index) => {
          const value = joinShortBodyLines(typeof item === 'string' ? item : item.text || item.description || '');
          const number = typeof item === 'string' ? String(index + 1).padStart(2, '0') : item.number || String(index + 1).padStart(2, '0');
          return `
            <div class="list-item">
              <span class="list-number">${escapeHtml(number)}</span>
              <p>${multiline(value)}</p>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

/**
 * Renders the inner content for one v2 layout card.
 */
function renderCardBody(card) {
  if (card.layout === '01') {
    return `
      <div class="cover-copy">
        <p class="kicker">${multiline(card.kicker || card.series || '')}</p>
        <h1>${multiline(card.title)}</h1>
        <p class="subtitle">${multiline(card.subtitle)}</p>
      </div>
    `;
  }

  if (card.layout === '02') {
    return `
      <div class="stack">
        <p class="label">${multiline(card.question_label || 'Question')}</p>
        <h2>${multiline(card.question)}</h2>
        <p class="label muted-label">${multiline(card.answer_label || 'Answer')}</p>
        <p class="body large">${multiline(joinShortBodyLines(card.answer, 22))}</p>
      </div>
    `;
  }

  if (card.layout === '03') {
    const problem = stripLeadingSectionLabel(card.problem, [
      card.problem_title,
      'Problem',
      '문제'
    ]);
    const solution = stripLeadingSectionLabel(card.solution, [
      card.solution_title,
      'Solution',
      '해결',
      '해결 방향',
      '방향'
    ]);

    return `
      <div class="stack">
        <h2>${multiline(card.title)}</h2>
        <div class="split-block">
          <p class="label">${multiline(card.problem_title || 'Problem')}</p>
          <p>${multiline(joinShortBodyLines(problem))}</p>
        </div>
        <div class="split-block accent-block">
          <p class="label">${multiline(card.solution_title || 'Solution')}</p>
          <p>${multiline(joinShortBodyLines(solution))}</p>
        </div>
      </div>
    `;
  }

  if (card.layout === '04') {
    return `
      <div class="stack">
        <h2>${multiline(card.title)}</h2>
        <div class="flow">
          ${(card.steps || [])
            .map(
              (step, index) => `
                <div class="flow-step">
                  <span>${index + 1}</span>
                  <div>
                    <h3>${multiline(step.title)}</h3>
                    <p>${multiline(joinShortBodyLines(step.description))}</p>
                  </div>
                </div>
              `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  if (card.layout === '05') {
    return `
      <div class="stack">
        <h2>${multiline(card.title)}</h2>
        ${renderList(card.items)}
      </div>
    `;
  }

  if (card.layout === '06') {
    const before = stripLeadingSectionLabel(card.before, ['Before', '비포']);
    const after = stripLeadingSectionLabel(card.after, ['After', '애프터']);

    return `
      <div class="stack">
        <h2>${multiline(card.title)}</h2>
        <div class="before-after">
          <section>
            <p class="label">Before</p>
            <p>${multiline(joinShortBodyLines(before))}</p>
          </section>
          <section class="after">
            <p class="label">After</p>
            <p>${multiline(joinShortBodyLines(after))}</p>
          </section>
        </div>
      </div>
    `;
  }

  if (card.layout === '07') {
    return `
      <div class="one-message">
        <h2>${multiline(card.title)}</h2>
        <p>${multiline(joinShortBodyLines(card.description, 22))}</p>
      </div>
    `;
  }

  if (card.layout === '08') {
    return `
      <div class="stack">
        <h2>${multiline(card.title)}</h2>
        ${renderList(card.items)}
      </div>
    `;
  }

  if (card.layout === '09') {
    return `
      <div class="closing">
        <h2>${multiline(card.title)}</h2>
        <p class="body large">${multiline(joinShortBodyLines(card.description, 22))}</p>
        <p class="save-note">${multiline(joinShortBodyLines(card.cta, 22))}</p>
      </div>
    `;
  }

  return `
    <div class="stack">
      <h2>${multiline(card.title || card.layout_name || 'Card')}</h2>
      <p class="body large">${multiline(joinShortBodyLines(card.description || card.body || '', 22))}</p>
    </div>
  `;
}

/**
 * Builds a complete HTML document for one Instagram sketch card.
 */
export function buildInstagramSketchCardHtml({ cwd, payload, card, total }) {
  const width = Number(payload.dimensions?.width || 1080);
  const height = Number(payload.dimensions?.height || 1350);
  const design = payload.design || {};
  const staticImage = card.staticImageDataUrl || card.staticImagePath
    ? toCssImageUrl({ cwd, value: card.staticImageDataUrl || card.staticImagePath })
    : '';
  const coverImage = card.layout === '01' ? resolveCoverImage({ cwd, payload }) : '';
  const slideClass = [
    'slide',
    `layout-${escapeHtml(card.layout || 'unknown')}`,
    `title-fit-${titleFitLevel(card)}`,
    `content-fit-${contentFitLevel(card)}`,
    card.layout === '01' ? 'cover' : '',
    staticImage ? 'static-image-slide' : '',
    coverImage ? 'has-cover-image' : ''
  ]
    .filter(Boolean)
    .join(' ');

  if (staticImage) {
    return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width}, height=${height}">
<style>
  * {
    box-sizing: border-box;
  }

  html,
  body {
    width: ${width}px;
    height: ${height}px;
    margin: 0;
    overflow: hidden;
    background: ${design.background || '#f7f1e3'};
  }

  .static-image-slide {
    width: ${width}px;
    height: ${height}px;
    background-image: ${staticImage};
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }
</style>
</head>
<body>
  <main class="${slideClass}" aria-label="${escapeHtml(card.layout_name || 'Static CTA')}"></main>
</body>
</html>`;
  }

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width}, height=${height}">
<style>
  :root {
    --bg: ${design.background || '#f7f1e3'};
    --fg: ${design.foreground || '#151515'};
    --muted: ${design.muted || '#706b61'};
    --accent: ${design.accent || '#c9f24d'};
    --border: ${design.border || '#1c1c1c'};
    --paper: #fbf6e8;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    width: ${width}px;
    height: ${height}px;
    margin: 0;
    overflow: hidden;
    background: var(--bg);
    color: var(--fg);
    font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif;
    letter-spacing: 0;
  }

  .slide {
    position: relative;
    width: ${width}px;
    height: ${height}px;
    padding: 92px 88px 86px;
    background:
      radial-gradient(circle at 18% 12%, rgba(201, 242, 77, 0.24), transparent 22%),
      linear-gradient(180deg, #fffaf0 0%, var(--bg) 100%);
    overflow: hidden;
  }

  .slide::after {
    content: "";
    position: absolute;
    inset: 34px;
    border: 4px solid var(--border);
    pointer-events: none;
  }

  .slide.has-cover-image {
    background: var(--bg);
  }

  .slide.has-cover-image::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: ${coverImage || 'none'};
    background-position: center;
    background-size: cover;
    filter: saturate(0.92) contrast(0.92);
  }

  .slide.has-cover-image .cover-copy {
    position: relative;
    margin-top: 0;
    padding: 30px 42px 36px;
    background: rgba(251, 246, 232, 0.91);
    border: 4px solid var(--border);
  }

  .brand {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 28px;
    font-weight: 800;
  }

  .brand span:last-child {
    color: var(--muted);
    font-size: 22px;
    font-weight: 700;
  }

  .content {
    position: relative;
    z-index: 2;
    height: calc(100% - 116px);
    display: flex;
    align-items: center;
  }

  .slide.has-cover-image .content {
    align-items: flex-end;
    height: calc(100% - 240px);
  }

  .layout-06 .content,
  .title-fit-tight .content,
  .title-fit-compressed .content {
    align-items: flex-start;
    padding-top: 72px;
  }

  .layout-06.title-fit-compressed .content {
    padding-top: 52px;
  }

  .layout-03.content-fit-tight .content,
  .layout-06.content-fit-tight .content {
    align-items: flex-start;
    height: calc(100% - 176px);
    padding-top: 48px;
  }

  .layout-03.content-fit-compressed .content,
  .layout-06.content-fit-compressed .content {
    align-items: flex-start;
    height: calc(100% - 186px);
    padding-top: 34px;
  }

  .layout-03.content-fit-compressed .content {
    height: calc(100% - 214px);
    padding-top: 62px;
  }

  .layout-06.content-fit-compressed .content {
    padding-top: 64px;
  }

  .stack,
  .cover-copy,
  .closing,
  .one-message {
    width: 100%;
  }

  .kicker,
  .label {
    display: inline-block;
    margin: 0 0 26px;
    padding: 11px 20px 12px;
    background: var(--accent);
    border: 3px solid var(--border);
    font-size: 25px;
    font-weight: 900;
    line-height: 1.15;
  }

  .muted-label {
    margin-top: 48px;
    background: transparent;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  h1 {
    max-width: 870px;
    font-size: 82px;
    line-height: 1.08;
    font-weight: 900;
    word-break: keep-all;
  }

  h2 {
    max-width: 850px;
    margin-bottom: 48px;
    font-size: 64px;
    line-height: 1.14;
    font-weight: 900;
    word-break: keep-all;
  }

  .title-fit-tight h1 {
    font-size: 72px;
    line-height: 1.08;
  }

  .title-fit-compressed h1 {
    font-size: 64px;
    line-height: 1.06;
  }

  .title-fit-tight h2 {
    margin-bottom: 36px;
    font-size: 58px;
    line-height: 1.1;
  }

  .title-fit-compressed h2 {
    margin-bottom: 28px;
    font-size: 50px;
    line-height: 1.08;
  }

  .content-fit-tight h2 {
    margin-bottom: 30px;
    font-size: 54px;
    line-height: 1.08;
  }

  .content-fit-compressed h2 {
    margin-bottom: 52px;
    font-size: 46px;
    line-height: 1.06;
  }

  .layout-03.content-fit-compressed h2 {
    margin-bottom: 50px;
    font-size: 42px;
    line-height: 1.05;
  }

  h3 {
    margin-bottom: 10px;
    font-size: 30px;
    line-height: 1.25;
  }

  .subtitle {
    max-width: 780px;
    margin-top: 32px;
    color: var(--muted);
    font-size: 34px;
    line-height: 1.4;
    font-weight: 700;
    word-break: keep-all;
  }

  .body,
  .split-block p,
  .flow-step p,
  .list-item p,
  .before-after p {
    color: var(--fg);
    font-size: 35px;
    line-height: 1.48;
    word-break: keep-all;
  }

  .large {
    max-width: 820px;
    font-size: 40px;
    line-height: 1.45;
  }

  .split-block,
  .flow-step,
  .list-item,
  .before-after section {
    background: rgba(255, 250, 240, 0.72);
    border: 4px solid var(--border);
    box-shadow: 10px 10px 0 rgba(21, 21, 21, 0.12);
  }

  .split-block {
    padding: 32px 34px;
    margin-bottom: 30px;
  }

  .layout-03.content-fit-tight .split-block {
    padding: 26px 30px;
    margin-bottom: 22px;
  }

  .layout-03.content-fit-compressed .split-block {
    padding: 16px 22px;
    margin-bottom: 14px;
    box-shadow: 8px 8px 0 rgba(21, 21, 21, 0.1);
  }

  .split-block .label,
  .before-after .label {
    margin-bottom: 16px;
    font-size: 22px;
  }

  .layout-03.content-fit-compressed .split-block .label,
  .layout-06.content-fit-compressed .before-after .label {
    margin-bottom: 10px;
    font-size: 20px;
  }

  .layout-03.content-fit-compressed .split-block .label {
    margin-bottom: 8px;
    padding: 8px 15px 9px;
    font-size: 18px;
  }

  .layout-03.content-fit-tight .split-block p:not(.label) {
    font-size: 32px;
    line-height: 1.38;
  }

  .layout-03.content-fit-compressed .split-block p:not(.label) {
    font-size: 26px;
    line-height: 1.24;
  }

  .accent-block {
    background: rgba(201, 242, 77, 0.28);
  }

  .flow {
    display: grid;
    gap: 24px;
  }

  .flow-step {
    display: grid;
    grid-template-columns: 74px 1fr;
    gap: 24px;
    padding: 28px 32px;
  }

  .flow-step span,
  .list-number {
    display: inline-flex;
    width: 54px;
    height: 54px;
    align-items: center;
    justify-content: center;
    border: 3px solid var(--border);
    background: var(--accent);
    font-size: 23px;
    font-weight: 900;
  }

  .item-list {
    display: grid;
    gap: 22px;
  }

  .list-item {
    display: grid;
    grid-template-columns: 72px 1fr;
    gap: 22px;
    align-items: start;
    padding: 26px 30px;
  }

  .before-after {
    display: grid;
    gap: 28px;
  }

  .before-after section {
    padding: 34px;
  }

  .before-after .after {
    background: rgba(201, 242, 77, 0.28);
  }

  .layout-06.title-fit-tight .before-after {
    gap: 24px;
  }

  .layout-06.title-fit-tight .before-after section {
    padding: 30px 34px;
  }

  .layout-06.title-fit-compressed .before-after {
    gap: 22px;
  }

  .layout-06.title-fit-compressed .before-after section {
    padding: 26px 30px;
  }

  .layout-06.title-fit-compressed .before-after section > p:not(.label) {
    font-size: 32px;
    line-height: 1.42;
  }

  .layout-06.content-fit-tight .before-after {
    gap: 20px;
  }

  .layout-06.content-fit-tight .before-after section {
    padding: 26px 30px;
  }

  .layout-06.content-fit-tight .before-after section > p:not(.label) {
    font-size: 31px;
    line-height: 1.36;
  }

  .layout-06.content-fit-compressed .before-after {
    gap: 16px;
  }

  .layout-06.content-fit-compressed .before-after section {
    padding: 20px 24px;
    box-shadow: 8px 8px 0 rgba(21, 21, 21, 0.1);
  }

  .layout-06.content-fit-compressed .before-after section > p:not(.label) {
    font-size: 28px;
    line-height: 1.28;
  }

  .one-message {
    padding: 56px;
    border: 5px solid var(--border);
    background: rgba(255, 250, 240, 0.74);
    box-shadow: 14px 14px 0 rgba(21, 21, 21, 0.12);
  }

  .one-message h2 {
    margin-bottom: 30px;
    font-size: 74px;
  }

  .one-message p {
    max-width: 780px;
    color: var(--muted);
    font-size: 36px;
    line-height: 1.45;
    font-weight: 700;
  }

  .closing h2 {
    font-size: 76px;
  }

  .save-note {
    display: inline-block;
    margin-top: 54px;
    padding: 20px 28px;
    border: 4px solid var(--border);
    background: var(--accent);
    font-size: 30px;
    line-height: 1.35;
    font-weight: 900;
  }

  .footer {
    position: absolute;
    z-index: 3;
    left: 88px;
    right: 88px;
    bottom: 72px;
    display: flex;
    justify-content: space-between;
    color: var(--muted);
    font-size: 22px;
    font-weight: 800;
  }

  .footer span:first-child {
    max-width: calc(100% - 96px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .slide.has-cover-image .footer span {
    padding: 5px 8px 6px;
    background: rgba(251, 246, 232, 0.78);
  }
</style>
</head>
<body>
  <main class="${slideClass}">
    <header class="brand">
      <span>${escapeHtml(payload.brandName || 'GrowthLine')}</span>
      <span>${escapeHtml(card.layout_name || '')}</span>
    </header>
    <section class="content">
      ${renderCardBody(card)}
    </section>
    <footer class="footer">
      <span>${escapeHtml(payload.contentTitle || payload.source?.title || '')}</span>
      <span>${escapeHtml(card.page || `${card.index}/${total}`)}</span>
    </footer>
  </main>
</body>
</html>`;
}

/**
 * Loads Playwright only for v2 rendering so legacy render paths stay dependency-light.
 */
async function loadChromium() {
  try {
    const { chromium } = await import('playwright');
    return chromium;
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error('Playwright is required for instagram-sketch-card-news-v2 rendering. Run npm ci and npx playwright install chromium.');
    }

    throw error;
  }
}

/**
 * Renders the v2 GrowthLine sketch card-news payload through Chromium screenshots.
 */
export async function renderInstagramSketchCardNews({ cwd, contentItemId, payload, paths, config, fetchImpl = fetch }) {
  const outputDir = paths?.outputDir || resolve(cwd, 'artifacts/generated/instagram', contentItemId);
  mkdirSync(outputDir, { recursive: true });

  const preparedPayload = await prepareCoverImage({
    config: {
      ...config,
      cwd
    },
    outputDir,
    payload,
    fetchImpl
  });
  const renderPayload = applyStaticFinalCtaCard({
    cwd,
    payload: preparedPayload,
    config
  });
  const cards = Array.isArray(renderPayload.cards) ? renderPayload.cards : [];
  if (cards.length === 0) {
    throw new Error('Instagram sketch renderer requires payload.cards.');
  }

  const chromium = await loadChromium();
  const width = Number(renderPayload.dimensions?.width || 1080);
  const height = Number(renderPayload.dimensions?.height || 1350);
  const browser = await chromium.launch({ headless: true });
  const slides = [];

  try {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1
    });

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      const fileName = `slide-${String(index + 1).padStart(2, '0')}.png`;
      const outputPath = join(outputDir, fileName);
      const html = buildInstagramSketchCardHtml({
        cwd,
        payload: renderPayload,
        card,
        total: cards.length
      });

      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => true) : true));
      await page.screenshot({ path: outputPath, fullPage: false });
      slides.push(outputPath);
    }
  } finally {
    await browser.close();
  }

  const manifestPath = join(outputDir, 'manifest.json');
  const manifest = {
    outputDir,
    slides,
    caption: renderPayload.caption,
    hashtags: renderPayload.hashtags,
    source: renderPayload.source,
    template: renderPayload.template,
    dimensions: renderPayload.dimensions,
    coverImagePrompt: renderPayload.coverImagePrompt,
    coverImage: renderPayload.coverImage || null,
    finalCtaImage: renderPayload.finalCtaImage || null
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {
    outputDir,
    manifestPath,
    slides,
    mode: 'playwright-html-css',
    template: payload.template
  };
}
