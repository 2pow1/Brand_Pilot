/**
 * Keeps Discord message fields under platform limits while preserving readable text.
 */
function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) return value || '';
  return `${value.slice(0, maxLength - 1)}…`;
}

/**
 * Builds the human-facing Discord review message body for one draft.
 */
export function buildReviewContent(item) {
  const parts = [
    `검수 요청: ${item.draft_title || item.source_title}`,
    '',
    `콘텐츠 ID: ${item.id}`,
    `소스: ${item.source_name}`,
    `원문: ${item.source_url}`,
    '',
    '초안:',
    truncate(item.draft_body || '(초안 본문 없음)', 1200),
    '',
    '승인하면 채널별 콘텐츠 생성 단계로 넘어갑니다.',
    '거절하면 해당 초안은 종료되고 다음 후보 검수로 넘어갑니다.'
  ];

  return truncate(parts.join('\n'), 1900);
}

/**
 * Builds Discord approval and rejection buttons with stable content IDs in custom_id values.
 */
export function buildReviewComponents(contentItemId) {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: '승인',
          custom_id: `brandpilot:approve:${contentItemId}`
        },
        {
          type: 2,
          style: 4,
          label: '거절',
          custom_id: `brandpilot:reject:${contentItemId}`
        }
      ]
    }
  ];
}

/**
 * Creates the complete Discord message payload sent to the review channel.
 */
export function buildReviewPayload(item) {
  return {
    content: buildReviewContent(item),
    components: buildReviewComponents(item.id),
    allowed_mentions: {
      parse: []
    }
  };
}
