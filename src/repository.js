import { getContentItemByFingerprint, insertContentItem, updateContentStatus } from './db.js';
import { fingerprint } from './ids.js';
import { assertContentTransition, CONTENT_STATUSES } from './state.js';

export function sourceFingerprintFor(source) {
  return fingerprint(`${source.sourceId}:${source.sourceUrl}:${source.sourceTitle}`);
}

export function createCollectedContent(db, source) {
  const sourceFingerprint = sourceFingerprintFor(source);
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

export function createCollectedContentIfNew(db, source) {
  const sourceFingerprint = sourceFingerprintFor(source);
  const existing = getContentItemByFingerprint(db, sourceFingerprint);

  if (existing) {
    return {
      item: existing,
      created: false
    };
  }

  return {
    item: createCollectedContent(db, source),
    created: true
  };
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
