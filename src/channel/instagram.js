/**
 * Collapses arbitrary whitespace so slide and caption text fits predictable card layouts.
 */
function normalizeWhitespace(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

/**
 * Shortens text for fixed-size Instagram slide regions while preserving a readable suffix.
 */
function truncate(value, maxLength) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

/**
 * Splits the approved draft body into sentence-like parts used by the card-news template.
 */
function splitDraftBody(body) {
  return normalizeWhitespace(body)
    .split(/(?<=[.!?。！？]|다\.|요\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Chooses the problem, insight, solution, and CTA copy blocks for the five-slide carousel.
 */
function pickBodyLines(item) {
  const sentences = splitDraftBody(item.draft_body);

  return {
    problem: truncate(sentences[0] || item.draft_body, 72),
    insight: truncate(sentences[1] || item.source_title, 82),
    solution: truncate(sentences[2] || item.draft_body, 92),
    cta: truncate(sentences[3] || '지금 우리 브랜드의 홍보 구조를 점검해보세요.', 86)
  };
}

/**
 * Builds the Instagram caption from the draft, derived slide copy, and brand CTA settings.
 */
function buildCaption({ brand, item, lines }) {
  const ctaLabel = brand.cta?.label || '상담 채널 확인하기';
  const ctaUrl = brand.cta?.url || '';

  return [
    `${item.draft_title || item.source_title}`,
    '',
    lines.problem,
    lines.solution,
    '',
    `${ctaLabel}${ctaUrl ? `: ${ctaUrl}` : ''}`
  ].join('\n');
}

/**
 * Converts an approved content item into the Instagram card-news payload stored in channel_outputs.
 */
export function createInstagramCardNewsPayload({ brand, item, channel }) {
  const lines = pickBodyLines(item);
  const companyName = brand.companyName || 'Brand Pilot';
  const ctaLabel = brand.cta?.label || '상담 채널 확인하기';

  return {
    channelId: 'instagram',
    brandName: companyName,
    format: channel.format,
    template: channel.template,
    dimensions: {
      width: 1080,
      height: 1080
    },
    design: {
      background: '#181818',
      foreground: '#f8fafc',
      muted: '#a3a3a3',
      accent: '#f15a24',
      logoPosition: 'top-center',
      pageIndicator: true
    },
    slides: [
      {
        index: 1,
        role: 'hook',
        headline: truncate(item.draft_title || item.source_title, 42),
        body: '대표님이 먼저 줄여야 할 홍보 고민',
        emphasis: '홍보 구조'
      },
      {
        index: 2,
        role: 'problem',
        label: '문제',
        headline: '막막함은 능력 문제가 아닙니다',
        body: lines.problem
      },
      {
        index: 3,
        role: 'insight',
        label: '인사이트',
        headline: '먼저 공통 메시지를 정리합니다',
        body: lines.insight
      },
      {
        index: 4,
        role: 'solution',
        label: companyName,
        headline: '채널보다 먼저 구조를 만듭니다',
        body: lines.solution
      },
      {
        index: 5,
        role: 'cta',
        headline: ctaLabel,
        body: lines.cta,
        qrTargetUrl: brand.cta?.url || ''
      }
    ],
    caption: buildCaption({ brand, item, lines }),
    hashtags: ['#브랜딩', '#마케팅', '#사업홍보', '#인스타그램마케팅', '#대표님콘텐츠'],
    source: {
      title: item.source_title,
      url: item.source_url
    }
  };
}
