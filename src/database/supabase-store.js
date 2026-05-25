import { createId } from '../ids.js';
import { buildPipelineProgress } from '../progress.js';
import { CHANNEL_STATUSES, CONTENT_STATUSES } from '../state.js';

/**
 * Fails fast when a required Supabase database setting is missing.
 */
function requireConfigValue(config, key, label) {
  if (!config[key]) {
    throw new Error(`${label} is required when DATABASE_PROVIDER=supabase`);
  }
}

/**
 * Normalizes Supabase project URLs before building REST endpoints.
 */
function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

/**
 * Returns the current timestamp for Supabase rows and events.
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Normalizes Supabase JSONB payloads to the string shape expected by existing CLI code.
 */
function normalizePayloadJson(row) {
  if (!row || typeof row.payload_json === 'string') return row;
  return {
    ...row,
    payload_json: JSON.stringify(row.payload_json || {})
  };
}

/**
 * Selects the event fields displayed in status summaries.
 */
function normalizeEvent(row) {
  return {
    id: row.id,
    content_item_id: row.content_item_id,
    event_type: row.event_type,
    created_at: row.created_at
  };
}

/**
 * Groups raw status rows into count rows for progress summaries.
 */
function countByStatus(rows) {
  const counts = new Map();
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) || 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => ({ status, count }));
}

/**
 * Counts publish-pending outputs by whether their artifact path is already public.
 */
function summarizePublishPendingArtifacts(rows) {
  const publishPendingRows = rows.filter((row) => {
    const content = row.content_items || {};
    return row.status === CHANNEL_STATUSES.PUBLISH_PENDING && content.status === CONTENT_STATUSES.PUBLISH_PENDING;
  });
  const publishReadyCount = publishPendingRows.filter((row) => /^https?:\/\//i.test(row.artifact_path || '')).length;

  return {
    uploadPendingCount: publishPendingRows.length - publishReadyCount,
    publishReadyCount
  };
}

/**
 * Flattens the Instagram channel output relation onto a content row for Notion sync.
 */
function normalizeNotionSyncRow(row) {
  const channelOutputs = row.channel_outputs || [];
  const instagramOutput = channelOutputs.find((output) => output.channel_id === 'instagram') || channelOutputs[0] || {};
  const { channel_outputs: _channelOutputs, ...content } = row;

  return {
    ...content,
    notion_channel_id: instagramOutput.channel_id || '',
    notion_channel_status: instagramOutput.status || '',
    notion_channel_payload_json: JSON.stringify(instagramOutput.payload_json || {}),
    notion_channel_artifact_path: instagramOutput.artifact_path || '',
    notion_channel_published_url: instagramOutput.published_url || '',
    notion_channel_last_error: instagramOutput.last_error || '',
    notion_channel_updated_at: instagramOutput.updated_at || '',
    notion_channel_backup_status: instagramOutput.backup_status || '',
    notion_channel_backup_completed_at: instagramOutput.backup_completed_at || '',
    notion_channel_backup_payload_json: JSON.stringify(instagramOutput.backup_payload_json || {}),
    notion_channel_backup_error: instagramOutput.backup_error || ''
  };
}

/**
 * Creates a Supabase REST-backed implementation of the shared store adapter.
 */
export function createSupabaseStore(config) {
  requireConfigValue(config, 'supabaseUrl', 'SUPABASE_URL');
  requireConfigValue(config, 'supabaseServiceRoleKey', 'SUPABASE_SERVICE_ROLE_KEY');

  const supabaseUrl = normalizeBaseUrl(config.supabaseUrl);
  const restUrl = `${supabaseUrl}/rest/v1`;
  const apiKey = config.supabaseServiceRoleKey;

  /**
   * Sends one authenticated Supabase REST request and parses the JSON response.
   */
  async function request(path, { method = 'GET', search = {}, body, prefer } = {}) {
    const url = new URL(`${restUrl}/${path}`);
    for (const [key, value] of Object.entries(search)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const headers = {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json'
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (prefer) {
      headers.Prefer = prefer;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(text || `Supabase request failed: HTTP ${response.status}`);
    }

    return text ? JSON.parse(text) : null;
  }

  /**
   * Inserts one audit event through the Supabase REST API.
   */
  async function insertEvent({ contentItemId = null, eventType, payload = {} }) {
    await request('events', {
      method: 'POST',
      body: {
        content_item_id: contentItemId,
        event_type: eventType,
        payload_json: payload
      },
      prefer: 'return=minimal'
    });
  }

  /**
   * Fetches the first row matching a REST query.
   */
  async function fetchOne(path, search) {
    const rows = await request(path, {
      search: {
        ...search,
        limit: 1
      }
    });
    return rows[0] || null;
  }

  /**
   * Updates one row and returns the updated representation.
   */
  async function patchOne(path, search, body) {
    const rows = await request(path, {
      method: 'PATCH',
      search,
      body,
      prefer: 'return=representation'
    });

    if (!rows?.[0]) {
      throw new Error(`${path} row not found`);
    }

    return rows[0];
  }

  return {
    provider: 'supabase',
    label: 'Supabase Postgres production database',
    location: supabaseUrl,

    /**
     * Keeps the store interface symmetrical with SQLite; Supabase has no local handle to close.
     */
    async close() {},

    /**
     * Runs a callback in the shared store interface; Supabase REST calls are individually committed.
     */
    async withTransaction(callback) {
      return callback();
    },

    /**
     * Loads one content item by ID.
     */
    async getContentItem(id) {
      return fetchOne('content_items', {
        select: '*',
        id: `eq.${id}`
      });
    },

    /**
     * Loads one content item by duplicate-detection fingerprint.
     */
    async getContentItemByFingerprint(sourceFingerprint) {
      return fetchOne('content_items', {
        select: '*',
        source_fingerprint: `eq.${sourceFingerprint}`
      });
    },

    /**
     * Inserts a collected content item and its creation event.
     */
    async insertContentItem(input) {
      const id = input.id || createId('content');
      const createdAt = nowIso();
      const rows = await request('content_items', {
        method: 'POST',
        body: {
          id,
          source_id: input.sourceId,
          source_name: input.sourceName,
          source_url: input.sourceUrl,
          source_title: input.sourceTitle,
          source_fingerprint: input.sourceFingerprint,
          raw_excerpt: input.rawExcerpt || '',
          status: input.status || CONTENT_STATUSES.COLLECTED,
          created_at: createdAt,
          updated_at: createdAt
        },
        prefer: 'return=representation'
      });

      await insertEvent({
        contentItemId: id,
        eventType: 'content.created',
        payload: { status: input.status || CONTENT_STATUSES.COLLECTED }
      });

      return rows[0];
    },

    /**
     * Appends an audit event.
     */
    async insertEvent(input) {
      return insertEvent(input);
    },

    /**
     * Lists content items by lifecycle status.
     */
    async listContentItemsByStatus(status, { limit = 10 } = {}) {
      return request('content_items', {
        search: {
          select: '*',
          status: `eq.${status}`,
          order: 'created_at.asc',
          limit
        }
      });
    },

    /**
     * Lists unsynced Notion rows first, then recently updated synced rows.
     */
    async listContentItemsForNotionSync({ limit = 10 } = {}) {
      const unsynced = await request('content_items', {
        search: {
          select: '*,channel_outputs(*)',
          notion_page_id: 'eq.',
          order: 'updated_at.desc',
          limit
        }
      });

      if (unsynced.length >= limit) {
        return unsynced;
      }

      const synced = await request('content_items', {
        search: {
          select: '*,channel_outputs(*)',
          notion_page_id: 'neq.',
          order: 'updated_at.desc',
          limit: limit - unsynced.length
        }
      });

      return [...unsynced, ...synced].map(normalizeNotionSyncRow);
    },

    /**
     * Stores draft fields for a content item.
     */
    async updateContentDraft({ id, draftTitle, draftBody, status, eventType, payload = {} }) {
      const updated = await patchOne(
        'content_items',
        { id: `eq.${id}` },
        {
          draft_title: draftTitle,
          draft_body: draftBody,
          status,
          updated_at: nowIso(),
          last_error: ''
        }
      );

      await insertEvent({
        contentItemId: id,
        eventType,
        payload: { ...payload, status }
      });

      return updated;
    },

    /**
     * Stores Discord review request metadata.
     */
    async updateReviewRequest({ id, reviewMessageId, status, eventType, payload = {} }) {
      const timestamp = nowIso();
      const updated = await patchOne(
        'content_items',
        { id: `eq.${id}` },
        {
          status,
          review_message_id: reviewMessageId,
          review_requested_at: timestamp,
          updated_at: timestamp,
          last_error: ''
        }
      );

      await insertEvent({
        contentItemId: id,
        eventType,
        payload: { ...payload, status, reviewMessageId }
      });

      return updated;
    },

    /**
     * Stores review approval or rejection metadata.
     */
    async updateReviewDecision({ id, status, rejectionReason = '', eventType, payload = {} }) {
      const timestamp = nowIso();
      const updated = await patchOne(
        'content_items',
        { id: `eq.${id}` },
        {
          status,
          review_decision_at: timestamp,
          rejection_reason: rejectionReason,
          updated_at: timestamp,
          last_error: ''
        }
      );

      await insertEvent({
        contentItemId: id,
        eventType,
        payload: { ...payload, status, rejectionReason }
      });

      return updated;
    },

    /**
     * Updates only the content lifecycle status.
     */
    async updateContentStatus({ id, status, eventType, payload = {} }) {
      const updated = await patchOne(
        'content_items',
        { id: `eq.${id}` },
        {
          status,
          updated_at: nowIso()
        }
      );

      await insertEvent({
        contentItemId: id,
        eventType,
        payload: { ...payload, status }
      });

      return updated;
    },

    /**
     * Stores Notion mirror metadata.
     */
    async updateContentNotionSync({ id, notionPageId, eventType, payload = {} }) {
      const timestamp = nowIso();
      const updated = await patchOne(
        'content_items',
        { id: `eq.${id}` },
        {
          notion_page_id: notionPageId,
          notion_synced_at: timestamp
        }
      );

      await insertEvent({
        contentItemId: id,
        eventType,
        payload: { ...payload, notionPageId }
      });

      return updated;
    },

    /**
     * Inserts or updates the channel-specific payload for one content item.
     */
    async upsertChannelOutput({
      contentItemId,
      channelId,
      status = CHANNEL_STATUSES.GENERATED,
      payload,
      artifactPath = '',
      publishedUrl = '',
      eventType,
      eventPayload = {}
    }) {
      const existing = await fetchOne('channel_outputs', {
        select: '*',
        content_item_id: `eq.${contentItemId}`,
        channel_id: `eq.${channelId}`
      });
      const timestamp = nowIso();
      let output;

      if (existing) {
        output = await patchOne(
          'channel_outputs',
          { id: `eq.${existing.id}` },
          {
            status,
            payload_json: payload,
            artifact_path: artifactPath,
            published_url: publishedUrl,
            updated_at: timestamp,
            last_error: ''
          }
        );
      } else {
        const rows = await request('channel_outputs', {
          method: 'POST',
          body: {
            id: createId('channel'),
            content_item_id: contentItemId,
            channel_id: channelId,
            status,
            payload_json: payload,
            artifact_path: artifactPath,
            published_url: publishedUrl,
            created_at: timestamp,
            updated_at: timestamp
          },
          prefer: 'return=representation'
        });
        output = rows[0];
      }

      await insertEvent({
        contentItemId,
        eventType,
        payload: {
          ...eventPayload,
          channelId,
          status
        }
      });

      return normalizePayloadJson(output);
    },

    /**
     * Lists generated channel outputs whose joined content item is ready for rendering.
     */
    async listChannelOutputsReadyToRender({ channelId, limit = 10 } = {}) {
      const rows = await request('channel_outputs', {
        search: {
          select: '*,content_items!inner(*)',
          channel_id: `eq.${channelId}`,
          status: `eq.${CHANNEL_STATUSES.GENERATED}`,
          'content_items.status': `eq.${CONTENT_STATUSES.CHANNEL_GENERATED}`,
          order: 'created_at.asc',
          limit
        }
      });

      return rows.map((row) => {
        const item = row.content_items;
        return {
          ...item,
          channel_output_id: row.id,
          output_channel_id: row.channel_id,
          channel_status: row.status,
          channel_payload_json: JSON.stringify(row.payload_json || {}),
          channel_artifact_path: row.artifact_path,
          channel_published_url: row.published_url,
          channel_attempt_count: row.attempt_count,
          channel_next_retry_at: row.next_retry_at,
          channel_locked_until: row.locked_until,
          channel_last_error: row.last_error
        };
      });
    },

    /**
     * Lists publish-pending channel outputs whose joined content item is ready for publishing.
     */
    async listChannelOutputsReadyToPublish({ channelId, limit = 10 } = {}) {
      const rows = await request('channel_outputs', {
        search: {
          select: '*,content_items!inner(*)',
          channel_id: `eq.${channelId}`,
          status: `eq.${CHANNEL_STATUSES.PUBLISH_PENDING}`,
          'content_items.status': `eq.${CONTENT_STATUSES.PUBLISH_PENDING}`,
          and: `(or(next_retry_at.is.null,next_retry_at.lte.${nowIso()}),or(locked_until.is.null,locked_until.lte.${nowIso()}))`,
          order: 'created_at.asc',
          limit
        }
      });

      return rows.map((row) => {
        const item = row.content_items;
        return {
          ...item,
          channel_output_id: row.id,
          output_channel_id: row.channel_id,
          channel_status: row.status,
          channel_payload_json: JSON.stringify(row.payload_json || {}),
          channel_artifact_path: row.artifact_path,
          channel_published_url: row.published_url,
          channel_attempt_count: row.attempt_count,
          channel_next_retry_at: row.next_retry_at,
          channel_locked_until: row.locked_until,
          channel_last_error: row.last_error
        };
      });
    },

    /**
     * Lists public channel artifacts that have a Notion page but are not backed up to Notion files yet.
     */
    async listChannelOutputsReadyForNotionBackup({ channelId, limit = 10 } = {}) {
      const rows = await request('channel_outputs', {
        search: {
          select: '*,content_items!inner(*)',
          channel_id: `eq.${channelId}`,
          status: `in.(${CHANNEL_STATUSES.PUBLISH_PENDING},${CHANNEL_STATUSES.PUBLISHED})`,
          backup_status: 'neq.backed_up',
          'content_items.notion_page_id': 'neq.',
          order: 'updated_at.asc',
          limit
        }
      });

      return rows
        .filter((row) => /^https?:\/\//i.test(row.artifact_path || ''))
        .map((row) => {
          const item = row.content_items;
          return {
            ...item,
            channel_output_id: row.id,
            output_channel_id: row.channel_id,
            channel_status: row.status,
            channel_payload_json: JSON.stringify(row.payload_json || {}),
            channel_artifact_path: row.artifact_path,
            channel_published_url: row.published_url,
            channel_backup_status: row.backup_status || '',
            channel_backup_completed_at: row.backup_completed_at || '',
            channel_backup_payload_json: JSON.stringify(row.backup_payload_json || {}),
            channel_backup_error: row.backup_error || ''
          };
        });
    },

    /**
     * Claims one publish-pending channel output before an external publish call.
     */
    async claimChannelOutputForPublish({ id, lockedUntil }) {
      const now = nowIso();
      const rows = await request('channel_outputs', {
        method: 'PATCH',
        search: {
          id: `eq.${id}`,
          status: `eq.${CHANNEL_STATUSES.PUBLISH_PENDING}`,
          and: `(or(next_retry_at.is.null,next_retry_at.lte.${now}),or(locked_until.is.null,locked_until.lte.${now}))`
        },
        body: {
          locked_until: lockedUntil,
          updated_at: now
        },
        prefer: 'return=representation'
      });

      return rows?.[0] ? normalizePayloadJson(rows[0]) : null;
    },

    /**
     * Stores a render or public upload artifact path on a channel output.
     */
    async updateChannelOutputArtifact({ id, status, artifactPath }) {
      const output = await patchOne(
        'channel_outputs',
        { id: `eq.${id}` },
        {
          status,
          artifact_path: artifactPath,
          updated_at: nowIso(),
          last_error: ''
        }
      );

      return normalizePayloadJson(output);
    },

    /**
     * Stores the external published URL for a channel output.
     */
    async updateChannelOutputPublished({ id, status, publishedUrl }) {
      const output = await patchOne(
        'channel_outputs',
        { id: `eq.${id}` },
        {
          status,
          published_url: publishedUrl,
          next_retry_at: null,
          locked_until: null,
          updated_at: nowIso(),
          last_error: ''
        }
      );

      return normalizePayloadJson(output);
    },

    /**
     * Stores a failed channel publish attempt without advancing lifecycle status.
     */
    async updateChannelOutputFailure({ id, attemptCount = 0, lastError, nextRetryAt }) {
      const output = await patchOne(
        'channel_outputs',
        { id: `eq.${id}` },
        {
          attempt_count: attemptCount + 1,
          next_retry_at: nextRetryAt,
          locked_until: null,
          last_error: lastError,
          updated_at: nowIso()
        }
      );

      return normalizePayloadJson(output);
    },

    /**
     * Stores Notion artifact backup status for a channel output.
     */
    async updateChannelOutputBackup({ id, backupStatus, backupPayload = {}, backupError = '' }) {
      const timestamp = nowIso();
      const output = await patchOne(
        'channel_outputs',
        { id: `eq.${id}` },
        {
          backup_status: backupStatus,
          backup_completed_at: backupStatus === 'backed_up' ? timestamp : null,
          backup_payload_json: backupPayload,
          backup_error: backupError,
          updated_at: timestamp
        }
      );

      return normalizePayloadJson(output);
    },

    /**
     * Builds a Supabase-backed status summary for the CLI.
     */
    async summarize() {
      const [contentRows, channelRows, eventRows] = await Promise.all([
        request('content_items', {
          search: { select: 'status' }
        }),
        request('channel_outputs', {
          search: { select: 'status,artifact_path,content_items(status)' }
        }),
        request('events', {
          search: {
            select: 'id,content_item_id,event_type,created_at',
            order: 'id.desc',
            limit: 10
          }
        })
      ]);
      const summary = {
        contentByStatus: countByStatus(contentRows),
        channelsByStatus: countByStatus(channelRows),
        publishPendingArtifacts: summarizePublishPendingArtifacts(channelRows),
        recentEvents: eventRows.map(normalizeEvent)
      };

      return {
        progress: buildPipelineProgress(summary),
        ...summary
      };
    }
  };
}
