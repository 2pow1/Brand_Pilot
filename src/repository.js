import {
  getContentItemByFingerprint,
  insertContentItem,
  updateChannelOutputArtifact,
  upsertChannelOutput,
  updateContentDraft,
  updateReviewDecision,
  updateReviewRequest,
  updateContentStatus
} from './db.js';
import { fingerprint } from './ids.js';
import { assertContentTransition, CHANNEL_STATUSES, CONTENT_STATUSES } from './state.js';

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

export function saveDraftForContent(db, item, draft, payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.DRAFT_CREATED);

  return updateContentDraft(db, {
    id: item.id,
    draftTitle: draft.title,
    draftBody: draft.body,
    status: CONTENT_STATUSES.DRAFT_CREATED,
    eventType: 'content.draft.created',
    payload: {
      ...payload,
      angle: draft.angle,
      keyPoints: draft.keyPoints,
      cta: draft.cta
    }
  });
}

export function requestReviewForContent(db, item, reviewMessageId, payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.PENDING_REVIEW);

  return updateReviewRequest(db, {
    id: item.id,
    reviewMessageId,
    status: CONTENT_STATUSES.PENDING_REVIEW,
    eventType: 'content.review.requested',
    payload
  });
}

export function approveContent(db, item, payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.APPROVED);

  return updateReviewDecision(db, {
    id: item.id,
    status: CONTENT_STATUSES.APPROVED,
    eventType: 'content.review.approved',
    payload
  });
}

export function rejectContent(db, item, reason = '', payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.REJECTED);

  return updateReviewDecision(db, {
    id: item.id,
    status: CONTENT_STATUSES.REJECTED,
    rejectionReason: reason,
    eventType: 'content.review.rejected',
    payload
  });
}

export function saveChannelOutputsForContent(db, item, outputs, payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.CHANNEL_GENERATED);

  db.exec('BEGIN');
  try {
    const savedOutputs = outputs.map((output) =>
      upsertChannelOutput(db, {
        contentItemId: item.id,
        channelId: output.channelId,
        payload: output.payload,
        eventType: 'content.channel.generated',
        eventPayload: {
          ...payload,
          channelId: output.channelId,
          template: output.payload.template
        }
      })
    );

    const updated = updateContentStatus(db, {
      id: item.id,
      status: CONTENT_STATUSES.CHANNEL_GENERATED,
      eventType: `content.transition.${item.status}.${CONTENT_STATUSES.CHANNEL_GENERATED}`,
      payload: {
        ...payload,
        channelIds: outputs.map((output) => output.channelId)
      }
    });

    db.exec('COMMIT');

    return {
      item: updated,
      outputs: savedOutputs
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function markChannelOutputRendered(db, item, channelOutput, artifactPath, payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.PUBLISH_PENDING);

  db.exec('BEGIN');
  try {
    const output = updateChannelOutputArtifact(db, {
      id: channelOutput.channel_output_id || channelOutput.id,
      status: CHANNEL_STATUSES.PUBLISH_PENDING,
      artifactPath
    });

    const updated = updateContentStatus(db, {
      id: item.id,
      status: CONTENT_STATUSES.PUBLISH_PENDING,
      eventType: `content.transition.${item.status}.${CONTENT_STATUSES.PUBLISH_PENDING}`,
      payload: {
        ...payload,
        channelId: channelOutput.output_channel_id || channelOutput.channel_id,
        artifactPath
      }
    });

    db.exec('COMMIT');

    return {
      item: updated,
      output
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
