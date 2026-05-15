const ARTICLE_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle', 'Report']);
const ARTICLE_PATH_HINTS = [
  'article',
  'blog',
  'insight',
  'knowhow',
  'trend',
  'marketing',
  'branding',
  'social-media',
  'strategy'
];

/**
 * Normalizes scraped text so titles and excerpts compare consistently.
 */
function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Decodes the small HTML entity set needed by source titles, URLs, and excerpts.
 */
function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

/**
 * Removes HTML tags from anchor text and returns plain text.
 */
function stripTags(value) {
  return normalizeWhitespace(decodeHtml(value.replace(/<[^>]*>/g, ' ')));
}

/**
 * Extracts a named attribute from a raw HTML tag string.
 */
function getAttr(tag, attrName) {
  const pattern = new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, 'i');
  return tag.match(pattern)?.[1] || '';
}

/**
 * Resolves relative source links against the source page URL.
 */
function toAbsoluteUrl(url, baseUrl) {
  try {
    return new URL(decodeHtml(url), baseUrl).toString();
  } catch {
    return '';
  }
}

/**
 * Checks whether a candidate URL is publishable HTTP(S) content.
 */
function isHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Removes trailing slashes so listing URLs can be compared reliably.
 */
function withoutTrailingSlash(url) {
  return url.replace(/\/+$/, '');
}

/**
 * Filters out home, category, tag, archive, and author pages from candidate lists.
 */
function isListingOrTaxonomyUrl(url, baseUrl) {
  const parsed = new URL(url);
  const path = parsed.pathname.toLowerCase();

  if (withoutTrailingSlash(url) === withoutTrailingSlash(new URL(baseUrl).toString())) {
    return true;
  }

  return [
    '/tag/',
    '/tags/',
    '/category/',
    '/categories/',
    '/archives/tag/',
    '/author/',
    '/authors/'
  ].some((segment) => path.includes(segment));
}

/**
 * Checks whether a candidate came from the same origin as the configured source.
 */
function sameOrigin(url, baseUrl) {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Scores candidates so article-like source URLs sort ahead of navigation links.
 */
function scoreCandidate(candidate, baseUrl) {
  let score = 0;

  if (sameOrigin(candidate.url, baseUrl)) score += 3;
  if (candidate.title.length >= 12) score += 2;
  if (candidate.excerpt) score += 1;

  const path = new URL(candidate.url).pathname.toLowerCase();
  if (ARTICLE_PATH_HINTS.some((hint) => path.includes(hint))) score += 4;
  if (/\/20\d{2}\//.test(path)) score += 2;

  return score;
}

/**
 * Converts raw scraped fields into a validated candidate or rejects unusable rows.
 */
function normalizeCandidate(candidate, baseUrl) {
  const url = toAbsoluteUrl(candidate.url || '', baseUrl);
  const title = normalizeWhitespace(candidate.title || '');
  const excerpt = normalizeWhitespace(candidate.excerpt || '');

  if (!url || !isHttpUrl(url) || title.length < 8) return null;
  if (isListingOrTaxonomyUrl(url, baseUrl)) return null;

  return {
    url,
    title,
    excerpt,
    score: scoreCandidate({ url, title, excerpt }, baseUrl)
  };
}

/**
 * Flattens JSON-LD graphs and item lists into records that can be inspected as articles.
 */
function flattenJsonLd(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (typeof value !== 'object') return [];

  const nested = [];
  if (value['@graph']) nested.push(...flattenJsonLd(value['@graph']));
  if (value.itemListElement) nested.push(...flattenJsonLd(value.itemListElement));
  if (value.item) nested.push(...flattenJsonLd(value.item));

  return [value, ...nested];
}

/**
 * Treats scalar JSON-LD values as arrays so type checks can be uniform.
 */
function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

/**
 * Checks whether a JSON-LD record declares an article-like schema type.
 */
function jsonLdTypeMatches(value) {
  const types = asArray(value['@type'] || []);
  return types.some((type) => ARTICLE_TYPES.has(type));
}

/**
 * Extracts article candidates from JSON-LD metadata blocks when a source provides them.
 */
function extractJsonLdCandidates(html, baseUrl) {
  const candidates = [];
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]).trim());
      for (const item of flattenJsonLd(parsed)) {
        if (!jsonLdTypeMatches(item) && !item.headline && !item.name) continue;

        const candidate = normalizeCandidate(
          {
            url: item.url || item['@id'] || item.mainEntityOfPage?.['@id'] || item.mainEntityOfPage,
            title: item.headline || item.name,
            excerpt: item.description || ''
          },
          baseUrl
        );

        if (candidate) candidates.push(candidate);
      }
    } catch {
      // Ignore malformed JSON-LD blocks and fall back to anchor extraction.
    }
  }

  return candidates;
}

/**
 * Extracts article candidates from anchor tags as a fallback for pages without JSON-LD.
 */
function extractAnchorCandidates(html, baseUrl) {
  const candidates = [];
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const href = getAttr(match[1], 'href');
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) continue;

    const candidate = normalizeCandidate(
      {
        url: href,
        title: stripTags(match[2]),
        excerpt: ''
      },
      baseUrl
    );

    if (candidate) candidates.push(candidate);
  }

  return candidates;
}

/**
 * Keeps the best-scored candidate for each URL after merging extraction strategies.
 */
function dedupeCandidates(candidates) {
  const byUrl = new Map();

  for (const candidate of candidates) {
    const existing = byUrl.get(candidate.url);
    if (!existing || candidate.score > existing.score) {
      byUrl.set(candidate.url, candidate);
    }
  }

  return [...byUrl.values()];
}

/**
 * Produces the final ranked candidate list from a source page's HTML.
 */
export function extractCandidatesFromHtml(html, { baseUrl, maxCandidates = 10 } = {}) {
  if (!baseUrl) throw new Error('baseUrl is required');

  const candidates = dedupeCandidates([
    ...extractJsonLdCandidates(html, baseUrl),
    ...extractAnchorCandidates(html, baseUrl)
  ]);

  return candidates
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, maxCandidates)
    .map(({ url, title, excerpt }) => ({ url, title, excerpt }));
}
