import { fetchHtml as defaultFetchHtml } from './fetch.js';
import { extractCandidatesFromHtml } from './html.js';

/**
 * Fetches one configured source and returns normalized content candidates for storage.
 */
export async function collectSource(source, options = {}) {
  const fetchHtml = options.fetchHtml || defaultFetchHtml;
  const maxCandidates = options.maxCandidatesPerSource || 10;
  const html = await fetchHtml(source.url, { timeoutMs: options.timeoutMs });
  const extractedCandidates = extractCandidatesFromHtml(html, {
    baseUrl: source.url,
    maxCandidates: maxCandidates * 4
  });
  const candidates = applySourcePathRules(extractedCandidates, source).slice(0, maxCandidates);

  return candidates.map((candidate) => ({
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: candidate.url,
    sourceTitle: candidate.title,
    rawExcerpt: candidate.excerpt || ''
  }));
}

/**
 * Applies per-source include and exclude path hints to keep only likely article URLs.
 */
function applySourcePathRules(candidates, source) {
  const includePathHints = source.includePathHints || [];
  const excludePathHints = source.excludePathHints || [];

  return candidates.filter((candidate) => {
    const path = new URL(candidate.url).pathname;
    const included =
      includePathHints.length === 0 ||
      includePathHints.some((hint) => hint === '/' || path.includes(hint));
    const excluded = excludePathHints.some((hint) => path.includes(hint));

    return included && !excluded;
  });
}

/**
 * Collects candidates from all enabled sources while preserving per-source failures.
 */
export async function collectSources(sources, options = {}) {
  const enabledSources = sources.filter((source) => source.enabled);
  const results = [];
  const errors = [];

  for (const source of enabledSources) {
    try {
      const candidates = await collectSource(source, options);
      results.push({
        source,
        candidates
      });
    } catch (error) {
      errors.push({
        source,
        error: error.message
      });
    }
  }

  return {
    results,
    errors,
    candidateCount: results.reduce((sum, result) => sum + result.candidates.length, 0)
  };
}
