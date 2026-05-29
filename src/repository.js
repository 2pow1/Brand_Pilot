import { fingerprint } from './ids.js';
import { assertContentTransition, CHANNEL_STATUSES, CONTENT_STATUSES } from './state.js';

const PUBLISH_LOCK_MINUTES = 30;
const BASE_RETRY_MINUTES = 15;
const MAX_RETRY_MINUTES = 360;

/**
 * Builds the duplicate-detection fingerprint for one scraped source candidate.
 */
export function sourceFingerprintFor(source) {
  return fingerprint(`${source.sourceId}:${source.sourceUrl}:${source.sourceTitle}`);
}

/**
 * Inserts a new collected content item without checking for duplicates.
 */
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

/**
 * Inserts a collected content item only when its source fingerprint is not already stored.
 */
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

/**
 * Moves a content item to another status after validating the lifecycle transition.
 */
export async function transitionContent(store, item, toStatus, payload = {}) {
  assertContentTransition(item.status, toStatus);

  return store.updateContentStatus({
    id: item.id,
    status: toStatus,
    eventType: `content.transition.${item.status}.${toStatus}`,
    payload
  });
}

/**
 * Stores the common draft and marks the item ready for human review.
 */
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
      hook: draft.hook,
      angle: draft.angle,
      keyPoints: draft.keyPoints,
      cta: draft.cta,
      ctaUrl: draft.ctaUrl,
      suggestedRepurpose: draft.suggestedRepurpose
    }
  });
}

/**
 * Records that a Discord review request has been created for a draft.
 */
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

/**
 * Marks a pending review as approved so channel-specific outputs can be generated.
 */
export async function approveContent(store, item, payload = {}) {
  assertContentTransition(item.status, CONTENT_STATUSES.APPROVED);

  return store.updateReviewDecision({
    id: item.id,
    status: CONTENT_STATUSES.APPROVED,
    eventType: 'content.review.approved',
    payload
  });
}

/**
 * Marks a pending review as rejected and closes that item from further automation.
 */
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

/**
 * Persists generated channel payloads and advances the content item to channel_generated.
 */
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

/**
 * Rebuilds channel payloads for an already approved or in-flight item and clears stale artifacts.
 */
export async function regenerateChannelOutputsForContent(store, item, outputs, payload = {}) {
  const allowedStatuses = new Set([
    CONTENT_STATUSES.APPROVED,
    CONTENT_STATUSES.CHANNEL_GENERATED,
    CONTENT_STATUSES.PUBLISH_PENDING
  ]);

  if (!allowedStatuses.has(item.status)) {
    throw new Error(`Cannot regenerate channel outputs from status: ${item.status}`);
  }

  return store.withTransaction(async () => {
    const savedOutputs = [];

    for (const output of outputs) {
      savedOutputs.push(await store.upsertChannelOutput({
        contentItemId: item.id,
        channelId: output.channelId,
        payload: output.payload,
        eventType: 'content.channel.regenerated',
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

/**
 * Records local render artifacts and advances the item to publish_pending.
 */
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

/**
 * Records a successful external publish and advances the item to published.
 */
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

/**
 * Returns an ISO timestamp for the end of a bounded publish lock.
 */
export function publishLockUntil(now = new Date()) {
  return new Date(now.getTime() + PUBLISH_LOCK_MINUTES * 60_000).toISOString();
}

/**
 * Calculates exponential retry delay for failed publish attempts.
 */
export function nextPublishRetryAt(attemptCount, now = new Date()) {
  const delayMinutes = Math.min(
    BASE_RETRY_MINUTES * 2 ** Math.max(0, attemptCount - 1),
    MAX_RETRY_MINUTES
  );
  return new Date(now.getTime() + delayMinutes * 60_000).toISOString();
}

/**
 * Claims a channel output before calling the external publish API.
 */
export async function claimChannelOutputForPublish(store, item, channelOutput, payload = {}) {
  const lockedUntil = publishLockUntil();
  const output = await store.claimChannelOutputForPublish({
    id: channelOutput.channel_output_id || channelOutput.id,
    lockedUntil
  });

  if (!output) {
    return null;
  }

  await store.insertEvent({
    contentItemId: item.id,
    eventType: 'content.channel.publish_claimed',
    payload: {
      ...payload,
      channelId: channelOutput.output_channel_id || channelOutput.channel_id,
      lockedUntil
    }
  });

  return {
    item,
    output
  };
}

/**
 * Records an external publish failure while keeping the item eligible for retry.
 */
export async function markChannelOutputPublishFailed(store, item, channelOutput, lastError, payload = {}) {
  return store.withTransaction(async () => {
    const currentAttemptCount = channelOutput.channel_attempt_count || channelOutput.attempt_count || 0;
    const nextAttemptCount = currentAttemptCount + 1;
    const nextRetryAt = nextPublishRetryAt(nextAttemptCount);
    const output = await store.updateChannelOutputFailure({
      id: channelOutput.channel_output_id || channelOutput.id,
      attemptCount: currentAttemptCount,
      lastError,
      nextRetryAt
    });

    await store.insertEvent({
      contentItemId: item.id,
      eventType: 'content.channel.publish_failed',
      payload: {
        ...payload,
        channelId: channelOutput.output_channel_id || channelOutput.channel_id,
        lastError,
        attemptCount: output.attempt_count,
        nextRetryAt
      }
    });

    return {
      item,
      output
    };
  });
}

/**
 * Records public Storage artifact URLs without changing the publish_pending content status.
 */
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

/**
 * Stores the Notion mirror page ID and sync timestamp for a content item.
 */
export async function markContentNotionSynced(store, item, notionPageId, payload = {}) {
  return store.updateContentNotionSync({
    id: item.id,
    notionPageId,
    eventType: 'content.notion.synced',
    payload
  });
}

/**
 * Records that public channel artifacts were imported into Notion-hosted files.
 */
export async function markChannelOutputNotionBackedUp(store, item, channelOutput, backupPayload = {}) {
  return store.withTransaction(async () => {
    const output = await store.updateChannelOutputBackup({
      id: channelOutput.channel_output_id || channelOutput.id,
      backupStatus: 'backed_up',
      backupPayload,
      backupError: ''
    });

    await store.insertEvent({
      contentItemId: item.id,
      eventType: 'content.notion.artifacts_backed_up',
      payload: {
        channelId: channelOutput.output_channel_id || channelOutput.channel_id,
        fileCount: backupPayload.files?.length || 0,
        ...backupPayload
      }
    });

    return {
      item,
      output
    };
  });
}

/**
 * Records a failed Notion artifact backup without changing content or publish status.
 */
export async function markChannelOutputNotionBackupFailed(store, item, channelOutput, backupError, backupPayload = {}) {
  return store.withTransaction(async () => {
    const output = await store.updateChannelOutputBackup({
      id: channelOutput.channel_output_id || channelOutput.id,
      backupStatus: 'failed',
      backupPayload,
      backupError
    });

    await store.insertEvent({
      contentItemId: item.id,
      eventType: 'content.notion.artifacts_backup_failed',
      payload: {
        channelId: channelOutput.output_channel_id || channelOutput.channel_id,
        backupError,
        ...backupPayload
      }
    });

    return {
      item,
      output
    };
  });
}

/**
 * Records that backed-up Storage artifacts were removed while keeping the content published.
 */
export async function markChannelOutputStorageCleaned(store, item, channelOutput, payload = {}) {
  if (item.status !== CONTENT_STATUSES.PUBLISHED) {
    throw new Error(`Expected published content before storage cleanup, received: ${item.status}`);
  }

  if ((channelOutput.channel_backup_status || channelOutput.backup_status) !== 'backed_up') {
    throw new Error('Storage cleanup requires channel artifact backup_status=backed_up');
  }

  return store.withTransaction(async () => {
    const output = await store.updateChannelOutputArtifact({
      id: channelOutput.channel_output_id || channelOutput.id,
      status: channelOutput.channel_status || channelOutput.status,
      artifactPath: ''
    });

    await store.insertEvent({
      contentItemId: item.id,
      eventType: 'content.storage.cleaned',
      payload: {
        channelId: channelOutput.output_channel_id || channelOutput.channel_id,
        ...payload
      }
    });

    return {
      item,
      output
    };
  });
}
