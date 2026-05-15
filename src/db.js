import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createId } from './ids.js';
import { buildPipelineProgress } from './progress.js';
import { CHANNEL_STATUSES, CONTENT_STATUSES } from './state.js';
import { nowIso } from './time.js';

/**
 * Opens a local SQLite database and configures safety pragmas for CLI use.
 */
export function openDatabase(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA journal_mode = WAL');
  return db;
}

/**
 * Adds a missing SQLite column during lightweight local migrations.
 */
function ensureColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) return;

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

/**
 * Creates or updates the local SQLite schema used as the development fallback store.
 */
export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_items (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_title TEXT NOT NULL,
      source_fingerprint TEXT NOT NULL UNIQUE,
      raw_excerpt TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      draft_title TEXT NOT NULL DEFAULT '',
      draft_body TEXT NOT NULL DEFAULT '',
      review_message_id TEXT NOT NULL DEFAULT '',
      review_requested_at TEXT,
      review_decision_at TEXT,
      rejection_reason TEXT NOT NULL DEFAULT '',
      notion_page_id TEXT NOT NULL DEFAULT '',
      notion_synced_at TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS channel_outputs (
      id TEXT PRIMARY KEY,
      content_item_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      artifact_path TEXT NOT NULL DEFAULT '',
      published_url TEXT NOT NULL DEFAULT '',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(content_item_id, channel_id),
      FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_item_id TEXT,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
    CREATE INDEX IF NOT EXISTS idx_channel_outputs_status ON channel_outputs(status);
    CREATE INDEX IF NOT EXISTS idx_events_content_item_id ON events(content_item_id);
  `);

  ensureColumn(db, 'content_items', 'notion_page_id', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'content_items', 'notion_synced_at', 'TEXT');
}

/**
 * Appends an audit event for a content item or system-level operation.
 */
export function insertEvent(db, { contentItemId = null, eventType, payload = {} }) {
  db.prepare(`
    INSERT INTO events (content_item_id, event_type, payload_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(contentItemId, eventType, JSON.stringify(payload), nowIso());
}

/**
 * Inserts a new content item in collected state and records its creation event.
 */
export function insertContentItem(db, input) {
  const id = input.id || createId('content');
  const createdAt = nowIso();

  db.prepare(`
    INSERT INTO content_items (
      id,
      source_id,
      source_name,
      source_url,
      source_title,
      source_fingerprint,
      raw_excerpt,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.sourceId,
    input.sourceName,
    input.sourceUrl,
    input.sourceTitle,
    input.sourceFingerprint,
    input.rawExcerpt || '',
    input.status || CONTENT_STATUSES.COLLECTED,
    createdAt,
    createdAt
  );

  insertEvent(db, {
    contentItemId: id,
    eventType: 'content.created',
    payload: { status: input.status || CONTENT_STATUSES.COLLECTED }
  });

  return getContentItem(db, id);
}

/**
 * Loads one content item by ID from the local SQLite store.
 */
export function getContentItem(db, id) {
  return db.prepare('SELECT * FROM content_items WHERE id = ?').get(id) || null;
}

/**
 * Loads one content item by source fingerprint for duplicate detection.
 */
export function getContentItemByFingerprint(db, sourceFingerprint) {
  return db.prepare('SELECT * FROM content_items WHERE source_fingerprint = ?').get(sourceFingerprint) || null;
}

/**
 * Lists content items in one lifecycle status ordered by creation time.
 */
export function listContentItemsByStatus(db, status, { limit = 10 } = {}) {
  return db.prepare(`
    SELECT *
    FROM content_items
    WHERE status = ?
    ORDER BY created_at ASC
    LIMIT ?
  `).all(status, limit);
}

/**
 * Lists content items that should be mirrored or refreshed in Notion.
 */
export function listContentItemsForNotionSync(db, { limit = 10 } = {}) {
  return db.prepare(`
    SELECT *
    FROM content_items
    ORDER BY
      CASE WHEN notion_page_id = '' THEN 0 ELSE 1 END,
      updated_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Stores draft fields and advances the local content row to draft_created.
 */
export function updateContentDraft(db, { id, draftTitle, draftBody, status, eventType, payload = {} }) {
  const updatedAt = nowIso();

  const result = db.prepare(`
    UPDATE content_items
    SET draft_title = ?,
        draft_body = ?,
        status = ?,
        updated_at = ?,
        last_error = ''
    WHERE id = ?
  `).run(draftTitle, draftBody, status, updatedAt, id);

  if (result.changes === 0) {
    throw new Error(`Content item not found: ${id}`);
  }

  insertEvent(db, {
    contentItemId: id,
    eventType,
    payload: { ...payload, status }
  });

  return getContentItem(db, id);
}

/**
 * Stores Discord review request metadata and advances the row to pending_review.
 */
export function updateReviewRequest(db, { id, reviewMessageId, status, eventType, payload = {} }) {
  const updatedAt = nowIso();

  const result = db.prepare(`
    UPDATE content_items
    SET status = ?,
        review_message_id = ?,
        review_requested_at = ?,
        updated_at = ?,
        last_error = ''
    WHERE id = ?
  `).run(status, reviewMessageId, updatedAt, updatedAt, id);

  if (result.changes === 0) {
    throw new Error(`Content item not found: ${id}`);
  }

  insertEvent(db, {
    contentItemId: id,
    eventType,
    payload: { ...payload, status, reviewMessageId }
  });

  return getContentItem(db, id);
}

/**
 * Stores approval or rejection metadata for a reviewed content item.
 */
export function updateReviewDecision(db, { id, status, rejectionReason = '', eventType, payload = {} }) {
  const updatedAt = nowIso();

  const result = db.prepare(`
    UPDATE content_items
    SET status = ?,
        review_decision_at = ?,
        rejection_reason = ?,
        updated_at = ?,
        last_error = ''
    WHERE id = ?
  `).run(status, updatedAt, rejectionReason, updatedAt, id);

  if (result.changes === 0) {
    throw new Error(`Content item not found: ${id}`);
  }

  insertEvent(db, {
    contentItemId: id,
    eventType,
    payload: { ...payload, status, rejectionReason }
  });

  return getContentItem(db, id);
}

/**
 * Inserts or replaces the channel-specific payload for one content item.
 */
export function upsertChannelOutput(
  db,
  {
    contentItemId,
    channelId,
    status = CHANNEL_STATUSES.GENERATED,
    payload,
    artifactPath = '',
    publishedUrl = '',
    eventType,
    eventPayload = {}
  }
) {
  const id = createId('channel');
  const now = nowIso();
  const payloadJson = JSON.stringify(payload);

  db.prepare(`
    INSERT INTO channel_outputs (
      id,
      content_item_id,
      channel_id,
      status,
      payload_json,
      artifact_path,
      published_url,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(content_item_id, channel_id) DO UPDATE SET
      status = excluded.status,
      payload_json = excluded.payload_json,
      artifact_path = excluded.artifact_path,
      published_url = excluded.published_url,
      updated_at = excluded.updated_at,
      last_error = ''
  `).run(id, contentItemId, channelId, status, payloadJson, artifactPath, publishedUrl, now, now);

  insertEvent(db, {
    contentItemId,
    eventType,
    payload: {
      ...eventPayload,
      channelId,
      status
    }
  });

  return db.prepare(`
    SELECT *
    FROM channel_outputs
    WHERE content_item_id = ? AND channel_id = ?
  `).get(contentItemId, channelId);
}

/**
 * Finds generated channel outputs whose content item is ready for local rendering.
 */
export function listChannelOutputsReadyToRender(db, { channelId, limit = 10 } = {}) {
  return db.prepare(`
    SELECT
      c.*,
      co.id AS channel_output_id,
      co.channel_id AS output_channel_id,
      co.status AS channel_status,
      co.payload_json AS channel_payload_json,
      co.artifact_path AS channel_artifact_path,
      co.published_url AS channel_published_url
    FROM channel_outputs co
    JOIN content_items c ON c.id = co.content_item_id
    WHERE co.channel_id = ?
      AND co.status = ?
      AND c.status = ?
    ORDER BY co.created_at ASC
    LIMIT ?
  `).all(channelId, CHANNEL_STATUSES.GENERATED, CONTENT_STATUSES.CHANNEL_GENERATED, limit);
}

/**
 * Finds rendered and uploaded channel outputs that are ready for external publishing.
 */
export function listChannelOutputsReadyToPublish(db, { channelId, limit = 10 } = {}) {
  return db.prepare(`
    SELECT
      c.*,
      co.id AS channel_output_id,
      co.channel_id AS output_channel_id,
      co.status AS channel_status,
      co.payload_json AS channel_payload_json,
      co.artifact_path AS channel_artifact_path,
      co.published_url AS channel_published_url
    FROM channel_outputs co
    JOIN content_items c ON c.id = co.content_item_id
    WHERE co.channel_id = ?
      AND co.status = ?
      AND c.status = ?
    ORDER BY co.created_at ASC
    LIMIT ?
  `).all(channelId, CHANNEL_STATUSES.PUBLISH_PENDING, CONTENT_STATUSES.PUBLISH_PENDING, limit);
}

/**
 * Stores a local or public artifact path on a channel output.
 */
export function updateChannelOutputArtifact(db, { id, status, artifactPath }) {
  const updatedAt = nowIso();

  const result = db.prepare(`
    UPDATE channel_outputs
    SET status = ?,
        artifact_path = ?,
        updated_at = ?,
        last_error = ''
    WHERE id = ?
  `).run(status, artifactPath, updatedAt, id);

  if (result.changes === 0) {
    throw new Error(`Channel output not found: ${id}`);
  }

  return db.prepare('SELECT * FROM channel_outputs WHERE id = ?').get(id);
}

/**
 * Stores the external published URL for a channel output.
 */
export function updateChannelOutputPublished(db, { id, status, publishedUrl }) {
  const updatedAt = nowIso();

  const result = db.prepare(`
    UPDATE channel_outputs
    SET status = ?,
        published_url = ?,
        updated_at = ?,
        last_error = ''
    WHERE id = ?
  `).run(status, publishedUrl, updatedAt, id);

  if (result.changes === 0) {
    throw new Error(`Channel output not found: ${id}`);
  }

  return db.prepare('SELECT * FROM channel_outputs WHERE id = ?').get(id);
}

/**
 * Updates only the content lifecycle status and records the transition event.
 */
export function updateContentStatus(db, { id, status, eventType, payload = {} }) {
  const updatedAt = nowIso();

  const result = db.prepare(`
    UPDATE content_items
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(status, updatedAt, id);

  if (result.changes === 0) {
    throw new Error(`Content item not found: ${id}`);
  }

  insertEvent(db, {
    contentItemId: id,
    eventType,
    payload: { ...payload, status }
  });

  return getContentItem(db, id);
}

/**
 * Stores Notion sync metadata on a content item.
 */
export function updateContentNotionSync(db, { id, notionPageId, eventType, payload = {} }) {
  const updatedAt = nowIso();

  const result = db.prepare(`
    UPDATE content_items
    SET notion_page_id = ?,
        notion_synced_at = ?
    WHERE id = ?
  `).run(notionPageId, updatedAt, id);

  if (result.changes === 0) {
    throw new Error(`Content item not found: ${id}`);
  }

  insertEvent(db, {
    contentItemId: id,
    eventType,
    payload: { ...payload, notionPageId }
  });

  return getContentItem(db, id);
}

/**
 * Builds a local database summary used by the status command.
 */
export function summarize(db) {
  const contentByStatus = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM content_items
    GROUP BY status
    ORDER BY status
  `).all();

  const channelsByStatus = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM channel_outputs
    GROUP BY status
    ORDER BY status
  `).all();

  const recentEvents = db.prepare(`
    SELECT id, content_item_id, event_type, created_at
    FROM events
    ORDER BY id DESC
    LIMIT 10
  `).all();

  const summary = {
    contentByStatus,
    channelsByStatus,
    recentEvents
  };

  return {
    progress: buildPipelineProgress(summary),
    ...summary
  };
}
