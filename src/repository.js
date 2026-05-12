import { fingerprint } from './ids.js';
import { assertContentTransition, CHANNEL_STATUSES, CONTENT_STATUSES } from './state.js';

export function sourceFingerprintFor(source) {
  return fingerprint(`${source.sourceId}:${source.sourceUrl}:${source.sourceTitle}`);
}

export async function createCollectedContent(store, source) {
  const sourceFingerprint = sourceFingerprintFor(source);
  return store.insertContentItem({
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    sourceTitle: source.sourceTitle,
    sourceFingerprint,
    rawExcerpt: source.rawExcerpt || '',
    status: CONTENT_STATUSES.COLLECTED
  });
}

export async function createCollectedContentIfNew(store, source) {
  const sourceFingerprint = sourceFingerprintFor(source);
  const existing = await store.getContentItemByFingerprint(sourceFingerprint);

  if (existing) {
    return {
      item: existing,
      created: false
    };
  }

  return {
    item: await createCollectedContent(store, source),
    created: true
  };
}

export async function transitionContent(store, item, toStatus, payload = {}) {
  assertContentTransition(item.status, toStatus);

  return store.updateContentStatus({
    id: item.id,
    status: toStatus,
    eventType: `content.transition.${item.status}.${toStatus}`,
    payload
  });
}

export async function saveDraftForContent(store, item, draft, payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.DRAFT_CREATED);

  return store.updateContentDraft({
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

export async function requestReviewForContent(store, item, reviewMessageId, payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.PENDING_REVIEW);

  return store.updateReviewRequest({
    id: item.id,
    reviewMessageId,
    status: CONTENT_STATUSES.PENDING_REVIEW,
    eventType: 'content.review.requested',
    payload
  });
}

export async function approveContent(store, item, payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.APPROVED);

  return store.updateReviewDecision({
    id: item.id,
    status: CONTENT_STATUSES.APPROVED,
    eventType: 'content.review.approved',
    payload
  });
}

export async function rejectContent(store, item, reason = '', payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.REJECTED);

  return store.updateReviewDecision({
    id: item.id,
    status: CONTENT_STATUSES.REJECTED,
    rejectionReason: reason,
    eventType: 'content.review.rejected',
    payload
  });
}

export async function saveChannelOutputsForContent(store, item, outputs, payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.CHANNEL_GENERATED);

  return store.withTransaction(async () => {
    const savedOutputs = [];

    for (const output of outputs) {
      savedOutputs.push(await store.upsertChannelOutput({
        contentItemId: item.id,
        channelId: output.channelId,
        payload: output.payload,
        eventType: 'content.channel.generated',
        eventPayload: {
          ...payload,
          channelId: output.channelId,
          template: output.payload.template
        }
      }));
    }

    const updated = await store.updateContentStatus({
      id: item.id,
      status: CONTENT_STATUSES.CHANNEL_GENERATED,
      eventType: `content.transition.${item.status}.${CONTENT_STATUSES.CHANNEL_GENERATED}`,
      payload: {
        ...payload,
        channelIds: outputs.map((output) => output.channelId)
      }
    });

    return {
      item: updated,
      outputs: savedOutputs
    };
  });
}

export async function markChannelOutputRendered(store, item, channelOutput, artifactPath, payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.PUBLISH_PENDING);

  return store.withTransaction(async () => {
    const output = await store.updateChannelOutputArtifact({
      id: channelOutput.channel_output_id || channelOutput.id,
      status: CHANNEL_STATUSES.PUBLISH_PENDING,
      artifactPath
    });

    const updated = await store.updateContentStatus({
      id: item.id,
      status: CONTENT_STATUSES.PUBLISH_PENDING,
      eventType: `content.transition.${item.status}.${CONTENT_STATUSES.PUBLISH_PENDING}`,
      payload: {
        ...payload,
        channelId: channelOutput.output_channel_id || channelOutput.channel_id,
        artifactPath
      }
    });

    return {
      item: updated,
      output
    };
  });
}

export async function markChannelOutputPublished(store, item, channelOutput, publishedUrl, payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.PUBLISHED);

  return store.withTransaction(async () => {
    const output = await store.updateChannelOutputPublished({
      id: channelOutput.channel_output_id || channelOutput.id,
      status: CHANNEL_STATUSES.PUBLISHED,
      publishedUrl
    });

    const updated = await store.updateContentStatus({
      id: item.id,
      status: CONTENT_STATUSES.PUBLISHED,
      eventType: `content.transition.${item.status}.${CONTENT_STATUSES.PUBLISHED}`,
      payload: {
        ...payload,
        channelId: channelOutput.output_channel_id || channelOutput.channel_id,
        publishedUrl
      }
    });

    return {
      item: updated,
      output
    };
  });
}

export async function markChannelOutputUploaded(store, item, channelOutput, artifactPath, payload = {}) {
  if (item.status !== CONTENT_STATUSES.PUBLISH_PENDING) {
    throw new Error(`Expected publish_pending content before upload, received: ${item.status}`);
  }

  return store.withTransaction(async () => {
    const output = await store.updateChannelOutputArtifact({
      id: channelOutput.channel_output_id || channelOutput.id,
      status: CHANNEL_STATUSES.PUBLISH_PENDING,
      artifactPath
    });

    await store.insertEvent({
      contentItemId: item.id,
      eventType: 'content.channel.uploaded',
      payload: {
        ...payload,
        channelId: channelOutput.output_channel_id || channelOutput.channel_id,
        artifactPath
      }
    });

    return {
      item,
      output
    };
  });
}
