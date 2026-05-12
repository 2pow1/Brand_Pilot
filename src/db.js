import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createId } from './ids.js';
import { buildPipelineProgress } from './progress.js';
import { CONTENT_STATUSES } from './state.js';
import { CHANNEL_STATUSES } from './state.js';
import { nowIso } from './time.js';

export function openDatabase(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA journal_mode = WAL');
  return db;
}

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
}

export function insertEvent(db, { contentItemId = null, eventType, payload = {} }) {
  db.prepare(`
    INSERT INTO events (content_item_id, event_type, payload_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(contentItemId, eventType, JSON.stringify(payload), nowIso());
}

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

export function getContentItem(db, id) {
  return db.prepare('SELECT * FROM content_items WHERE id = ?').get(id) || null;
}

export function getContentItemByFingerprint(db, sourceFingerprint) {
  return db.prepare('SELECT * FROM content_items WHERE source_fingerprint = ?').get(sourceFingerprint) || null;
}

export function listContentItemsByStatus(db, status, { limit = 10 } = {}) {
  return db.prepare(`
    SELECT *
    FROM content_items
    WHERE status = ?
    ORDER BY created_at ASC
    LIMIT ?
  `).all(status, limit);
}

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
