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
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Returns true only when a real CTA URL is configured for the operating brand.
 */
function hasVisibleCta(brand) {
  return Boolean(brand.cta?.enabled && normalizeWhitespace(brand.cta?.url));
}

/**
 * Chooses the problem, insight, solution, and closing copy blocks for the five-slide carousel.
 */
function pickBodyLines(item, companyName) {
  const sentences = splitDraftBody(item.draft_body);

  return {
    problem: truncate(sentences[0] || item.draft_body, 72),
    insight: truncate(sentences[1] || item.source_title, 82),
    solution: truncate(sentences[2] || item.draft_body, 92),
    closing: truncate(
      sentences[3] ||
        `${companyName}은 작은 사업의 브랜딩과 홍보 메시지를 고객이 이해하는 구조로 정리합니다.`,
      86
    )
  };
}

/**
 * Builds the Instagram caption from the draft and optional brand CTA settings.
 */
function buildCaption({ brand, item, lines }) {
  const parts = [
    `${item.draft_title || item.source_title}`,
    '',
    lines.problem,
    lines.solution
  ];

  if (hasVisibleCta(brand)) {
    const ctaLabel = brand.cta?.label || '상담 채널 확인하기';
    parts.push('', `${ctaLabel}: ${brand.cta.url}`);
  }

  return parts.join('\n');
}

/**
 * Converts an approved content item into the Instagram card-news payload stored in channel_outputs.
 */
export function createInstagramCardNewsPayload({ brand, item, channel }) {
  const companyName = brand.companyName || 'GrowthLine';
  const lines = pickBodyLines(item, companyName);
  const visibleCta = hasVisibleCta(brand);
  const ctaLabel = brand.cta?.label || '상담 채널 확인하기';

  const finalSlide = visibleCta
    ? {
        index: 5,
        role: 'cta',
        headline: ctaLabel,
        body: lines.closing,
        qrTargetUrl: brand.cta.url
      }
    : {
        index: 5,
        role: 'closing',
        label: companyName,
        headline: '홍보는 더 자주가 아니라 더 선명하게',
        body: lines.closing
      };

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
        body: '대표님이 먼저 줄여야 할 것은 더 많은 홍보가 아닙니다.',
        emphasis: '홍보 구조'
      },
      {
        index: 2,
        role: 'problem',
        label: '문제',
        headline: '노력이 부족한 게 아니라 구조가 흐릿한 겁니다',
        body: lines.problem
      },
      {
        index: 3,
        role: 'insight',
        label: '인사이트',
        headline: '고객은 설명보다 느낌으로 먼저 판단합니다',
        body: lines.insight
      },
      {
        index: 4,
        role: 'solution',
        label: companyName,
        headline: '채널보다 먼저 메시지 구조를 만듭니다',
        body: lines.solution
      },
      finalSlide
    ],
    caption: buildCaption({ brand, item, lines }),
    hashtags: ['#브랜딩', '#마케팅', '#사업홍보', '#인스타그램마케팅', '#대표님콘텐츠'],
    source: {
      title: item.source_title,
      url: item.source_url
    }
  };
}

/**
 * Adds a leading hash mark to model-provided hashtag text and drops unusable values.
 */
function normalizeHashtag(value) {
  const normalized = normalizeWhitespace(value).replace(/\s+/g, '');
  if (!normalized) return '';
  return normalized.startsWith('#') ? normalized : `#${normalized}`;
}

/**
 * Prevents inactive CTA URLs from leaking into generated captions.
 */
function captionWithoutInactiveCta(caption) {
  return normalizeWhitespace(caption).replace(/https?:\/\/\S+/gi, '').trim();
}

/**
 * Applies GPT-written Instagram copy while preserving renderer-critical template fields.
 */
export function applyInstagramCardNewsAdaptation({ brand, item, channel, adaptation }) {
  const base = createInstagramCardNewsPayload({ brand, item, channel });
  const adaptedSlides = Array.isArray(adaptation?.slides) ? adaptation.slides : [];
  const visibleCta = hasVisibleCta(brand);
  const slides = base.slides.map((baseSlide, index) => {
    const adapted = adaptedSlides[index] || {};
    const slide = {
      ...baseSlide,
      label: normalizeWhitespace(adapted.label) || baseSlide.label,
      headline: normalizeWhitespace(adapted.headline) || baseSlide.headline,
      body: normalizeWhitespace(adapted.body) || baseSlide.body,
      emphasis: normalizeWhitespace(adapted.emphasis) || baseSlide.emphasis
    };

    if (!visibleCta) {
      delete slide.qrTargetUrl;
    }

    return slide;
  });
  const caption = normalizeWhitespace(adaptation?.caption);
  const hashtags = Array.isArray(adaptation?.hashtags)
    ? adaptation.hashtags.map(normalizeHashtag).filter(Boolean)
    : [];

  return {
    ...base,
    slides,
    caption: visibleCta ? caption || base.caption : captionWithoutInactiveCta(caption || base.caption),
    hashtags: hashtags.length > 0 ? [...new Set(hashtags)] : base.hashtags,
    generation: {
      mode: 'openai-channel-adaptation',
      visualNotes: normalizeWhitespace(adaptation?.visual_notes)
    }
  };
}
