export const SKETCH_CHROME_MODES = Object.freeze(['normal', 'compact', 'hidden']);

export const DEFAULT_SKETCH_CHROME = Object.freeze({
  header: 'normal',
  footer: 'normal'
});

const CHROME_MODE_SET = new Set(SKETCH_CHROME_MODES);

export function normalizeSketchChromeMode(value, fallback = 'normal') {
  if (value === false) return 'hidden';
  if (value === true) return fallback;

  const mode = String(value ?? '').trim().toLowerCase();
  return CHROME_MODE_SET.has(mode) ? mode : fallback;
}

export function normalizeSketchChrome(value = {}) {
  return {
    header: normalizeSketchChromeMode(value.header ?? value.top, DEFAULT_SKETCH_CHROME.header),
    footer: normalizeSketchChromeMode(value.footer ?? value.bottom, DEFAULT_SKETCH_CHROME.footer)
  };
}
