import { insertContentItem, updateContentStatus } from './db.js';
import { fingerprint } from './ids.js';
import { assertContentTransition, CONTENT_STATUSES } from './state.js';

export function createCollectedContent(db, source) {
  const sourceFingerprint = fingerprint(`${source.sourceId}:${source.sourceUrl}:${source.sourceTitle}`);

  return insertContentItem(db, {
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    sourceTitle: source.sourceTitle,
    sourceFingerprint,
    rawExcerpt: source.rawExcerpt || '',
    status: CONTENT_STATUSES.COLLECTED
  });
}

export function transitionContent(db, item, toStatus, payload = {}) {
  assertContentTransition(item.status, toStatus);

  return updateContentStatus(db, {
    id: item.id,
    status: toStatus,
    eventType: `content.transition.${item.status}.${toStatus}`,
    payload
  });
}
