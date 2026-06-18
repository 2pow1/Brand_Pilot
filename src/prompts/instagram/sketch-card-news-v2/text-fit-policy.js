export const SKETCH_TITLE_FIELDS = Object.freeze({
  '02': 'question'
});

export const SKETCH_TITLE_BUDGETS = Object.freeze({
  '01': { normal: 28, tight: 38, maxLines: 2, maxLineLength: 16 },
  '02': { normal: 26, tight: 36, maxLines: 2, maxLineLength: 16 },
  '03': { normal: 26, tight: 36, maxLines: 2, maxLineLength: 16 },
  '04': { normal: 26, tight: 36, maxLines: 2, maxLineLength: 16 },
  '05': { normal: 24, tight: 34, maxLines: 2, maxLineLength: 15 },
  '06': { normal: 24, tight: 32, maxLines: 2, maxLineLength: 14 },
  '07': { normal: 30, tight: 42, maxLines: 2, maxLineLength: 17 },
  '08': { normal: 24, tight: 34, maxLines: 2, maxLineLength: 15 },
  '09': { normal: 28, tight: 40, maxLines: 2, maxLineLength: 16 }
});

export const SKETCH_CONTENT_FIELDS = Object.freeze({
  '02': ['answer'],
  '03': ['problem', 'solution'],
  '04': ['steps'],
  '05': ['items'],
  '06': ['before', 'after'],
  '07': ['description'],
  '08': ['items'],
  '09': ['description', 'cta']
});

export const SKETCH_CONTENT_BUDGETS = Object.freeze({
  '02': { normal: 105, tight: 140, normalLines: 6, tightLines: 8, maxLineLength: 18, compressedLineMinLength: 105 },
  '03': { normal: 110, tight: 150, normalLines: 9, tightLines: 12, maxLineLength: 18, compressedLineMinLength: 110 },
  '04': { normal: 135, tight: 175, normalLines: 10, tightLines: 13, maxLineLength: 18, compressedLineMinLength: 135 },
  '05': { normal: 130, tight: 170, normalLines: 9, tightLines: 12, maxLineLength: 18, compressedLineMinLength: 130 },
  '06': { normal: 110, tight: 145, normalLines: 8, tightLines: 10, maxLineLength: 17, compressedLineMinLength: 110 },
  '07': { normal: 110, tight: 145, normalLines: 5, tightLines: 7, maxLineLength: 20, compressedLineMinLength: 110 },
  '08': { normal: 130, tight: 170, normalLines: 9, tightLines: 12, maxLineLength: 18, compressedLineMinLength: 130 },
  '09': { normal: 120, tight: 160, normalLines: 7, tightLines: 9, maxLineLength: 18, compressedLineMinLength: 120 }
});

/**
 * Trims card text while preserving intentional line breaks for HTML layouts.
 */
export function normalizeSketchText(value) {
  return (value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function visibleLength(value) {
  return Array.from(String(value ?? '').replace(/\s+/g, '')).length;
}

export function countVisibleCharacters(value) {
  return visibleLength(normalizeSketchText(value));
}

export function joinShortBodyLines(value, maxLineLength = 18) {
  const normalized = normalizeSketchText(value);
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
        if (previous && visibleLength(combined) <= maxLineLength) {
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

function analyzeSketchTitle(value) {
  const lines = normalizeSketchText(value).split('\n').filter(Boolean);
  const measuredLines = lines.length > 0 ? lines : [''];

  return {
    length: countVisibleCharacters(value),
    lineCount: measuredLines.length,
    maxLineLength: Math.max(...measuredLines.map(countVisibleCharacters))
  };
}

export function classifySketchTitleFit({ layout, value }) {
  const budget = SKETCH_TITLE_BUDGETS[layout] || { normal: 26, tight: 36, maxLines: 2, maxLineLength: 16 };
  const metrics = analyzeSketchTitle(value);
  const level =
    metrics.length > budget.tight ||
    metrics.maxLineLength > budget.maxLineLength + 6 ||
    metrics.lineCount > budget.maxLines + 1
      ? 'compressed'
      : metrics.length > budget.normal ||
          metrics.maxLineLength > budget.maxLineLength ||
          metrics.lineCount > budget.maxLines
        ? 'tight'
        : 'normal';

  return {
    level,
    length: metrics.length,
    lineCount: metrics.lineCount,
    maxLineLength: metrics.maxLineLength,
    budget
  };
}

function textPartsFromSketchValue(value) {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textPartsFromSketchValue);
  if (typeof value === 'object') {
    return Object.values(value).flatMap(textPartsFromSketchValue);
  }
  return [];
}

function analyzeSketchContent({ layout, card, budget }) {
  const fields = SKETCH_CONTENT_FIELDS[layout] || [];
  const parts = fields.flatMap((field) => textPartsFromSketchValue(card[field]));
  const lines = parts
    .flatMap((part) => normalizeSketchText(part).split('\n'))
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      length: 0,
      lineCount: 0,
      estimatedLineCount: 0,
      maxLineLength: 0,
      fields
    };
  }

  return {
    length: countVisibleCharacters(parts.join('\n')),
    lineCount: lines.length,
    estimatedLineCount: lines.reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(countVisibleCharacters(line) / budget.maxLineLength)),
      0
    ),
    maxLineLength: Math.max(...lines.map(countVisibleCharacters)),
    fields
  };
}

export function classifySketchContentFit({ layout, card }) {
  const budget = SKETCH_CONTENT_BUDGETS[layout] || {
    normal: 110,
    tight: 150,
    normalLines: 8,
    tightLines: 11,
    maxLineLength: 18,
    compressedLineMinLength: 110
  };
  const metrics = analyzeSketchContent({ layout, card, budget });
  const lineOverflowIsDense =
    metrics.estimatedLineCount > budget.tightLines &&
    metrics.length > (budget.compressedLineMinLength ?? budget.normal);
  const level =
    metrics.length > budget.tight ||
    lineOverflowIsDense ||
    metrics.maxLineLength > budget.maxLineLength + 8
      ? 'compressed'
      : metrics.length > budget.normal ||
          metrics.estimatedLineCount > budget.normalLines ||
          metrics.maxLineLength > budget.maxLineLength
        ? 'tight'
        : 'normal';

  return {
    level,
    length: metrics.length,
    lineCount: metrics.lineCount,
    estimatedLineCount: metrics.estimatedLineCount,
    maxLineLength: metrics.maxLineLength,
    fields: metrics.fields,
    budget
  };
}
