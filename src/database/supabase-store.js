import { createId } from '../ids.js';
import { buildPipelineProgress } from '../progress.js';
import { CHANNEL_STATUSES, CONTENT_STATUSES } from '../state.js';

function requireConfigValue(config, key, label) {
  if (!config[key]) {
    throw new Error(`${label} is required when DATABASE_PROVIDER=supabase`);
  }
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function nowIso() {
  return new Date().toISOString();
}

function normalizePayloadJson(row) {
  if (!row || typeof row.payload_json === 'string') return row;
  return {
    ...row,
    payload_json: JSON.stringify(row.payload_json || {})
  };
}

function normalizeEvent(row) {
  return {
    id: row.id,
    content_item_id: row.content_item_id,
    event_type: row.event_type,
    created_at: row.created_at
  };
}

function countByStatus(rows) {
  const counts = new Map();
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) || 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => ({ status, count }));
}

export function createSupabaseStore(config) {
  requireConfigValue(config, 'supabaseUrl', 'SUPABASE_URL');
  requireConfigValue(config, 'supabaseServiceRoleKey', 'SUPABASE_SERVICE_ROLE_KEY');

  const supabaseUrl = normalizeBaseUrl(config.supabaseUrl);
  const restUrl = `${supabaseUrl}/rest/v1`;
  const apiKey = config.supabaseServiceRoleKey;

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

  async function fetchOne(path, search) {
    const rows = await request(path, {
      search: {
        ...search,
        limit: 1
      }
    });
    return rows[0] || null;
  }

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

    async close() {},

    async withTransaction(callback) {
      return callback();
    },

    async getContentItem(id) {
      return fetchOne('content_items', {
        select: '*',
        id: `eq.${id}`
      });
    },

    async getContentItemByFingerprint(sourceFingerprint) {
      return fetchOne('content_items', {
        select: '*',
        source_fingerprint: `eq.${sourceFingerprint}`
      });
    },

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

    async insertEvent(input) {
      return insertEvent(input);
    },

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
          channel_published_url: row.published_url
        };
      });
    },

    async listChannelOutputsReadyToPublish({ channelId, limit = 10 } = {}) {
      const rows = await request('channel_outputs', {
        search: {
          select: '*,content_items!inner(*)',
          channel_id: `eq.${channelId}`,
          status: `eq.${CHANNEL_STATUSES.PUBLISH_PENDING}`,
          'content_items.status': `eq.${CONTENT_STATUSES.PUBLISH_PENDING}`,
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
          channel_published_url: row.published_url
        };
      });
    },

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

    async updateChannelOutputPublished({ id, status, publishedUrl }) {
      const output = await patchOne(
        'channel_outputs',
        { id: `eq.${id}` },
        {
          status,
          published_url: publishedUrl,
          updated_at: nowIso(),
          last_error: ''
        }
      );

      return normalizePayloadJson(output);
    },

    async summarize() {
      const [contentRows, channelRows, eventRows] = await Promise.all([
        request('content_items', {
          search: { select: 'status' }
        }),
        request('channel_outputs', {
          search: { select: 'status' }
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
        recentEvents: eventRows.map(normalizeEvent)
      };

      return {
        progress: buildPipelineProgress(summary),
        ...summary
      };
    }
  };
}
