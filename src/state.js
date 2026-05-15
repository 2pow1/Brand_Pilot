export const CONTENT_STATUSES = Object.freeze({
  COLLECTED: 'collected',
  DRAFT_CREATED: 'draft_created',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CHANNEL_GENERATED: 'channel_generated',
  PUBLISH_PENDING: 'publish_pending',
  PUBLISHED: 'published',
  FAILED: 'failed'
});

export const CHANNEL_STATUSES = Object.freeze({
  GENERATED: 'generated',
  PUBLISH_PENDING: 'publish_pending',
  PUBLISHED: 'published',
  FAILED: 'failed'
});

const ALLOWED_CONTENT_TRANSITIONS = Object.freeze({
  [CONTENT_STATUSES.COLLECTED]: new Set([CONTENT_STATUSES.DRAFT_CREATED, CONTENT_STATUSES.FAILED]),
  [CONTENT_STATUSES.DRAFT_CREATED]: new Set([CONTENT_STATUSES.PENDING_REVIEW, CONTENT_STATUSES.FAILED]),
  [CONTENT_STATUSES.PENDING_REVIEW]: new Set([
    CONTENT_STATUSES.APPROVED,
    CONTENT_STATUSES.REJECTED,
    CONTENT_STATUSES.FAILED
  ]),
  [CONTENT_STATUSES.APPROVED]: new Set([CONTENT_STATUSES.CHANNEL_GENERATED, CONTENT_STATUSES.FAILED]),
  [CONTENT_STATUSES.CHANNEL_GENERATED]: new Set([CONTENT_STATUSES.PUBLISH_PENDING, CONTENT_STATUSES.FAILED]),
  [CONTENT_STATUSES.PUBLISH_PENDING]: new Set([CONTENT_STATUSES.PUBLISHED, CONTENT_STATUSES.FAILED]),
  [CONTENT_STATUSES.REJECTED]: new Set([]),
  [CONTENT_STATUSES.PUBLISHED]: new Set([]),
  [CONTENT_STATUSES.FAILED]: new Set([])
});

/**
 * Ensures content only moves through the allowed lifecycle transitions.
 */
export function assertContentTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_CONTENT_TRANSITIONS[fromStatus];
  if (!allowed) {
    throw new Error(`Unknown content status: ${fromStatus}`);
  }

  if (!allowed.has(toStatus)) {
    throw new Error(`Invalid content transition: ${fromStatus} -> ${toStatus}`);
  }
}

/**
 * Exposes allowed status transitions for CLI inspection and documentation.
 */
export function contentTransitions() {
  return Object.fromEntries(
    Object.entries(ALLOWED_CONTENT_TRANSITIONS).map(([status, next]) => [status, [...next]])
  );
}
