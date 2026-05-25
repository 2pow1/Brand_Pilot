import { databasePathFromUrl } from '../config.js';
import {
  getContentItem,
  getContentItemByFingerprint,
  claimChannelOutputForPublish,
  insertEvent,
  insertContentItem,
  listChannelOutputsReadyToRender,
  listChannelOutputsReadyToPublish,
  listContentItemsForNotionSync,
  listContentItemsByStatus,
  migrate,
  openDatabase,
  summarize,
  updateChannelOutputArtifact,
  updateChannelOutputFailure,
  updateChannelOutputPublished,
  updateContentNotionSync,
  updateContentDraft,
  updateContentStatus,
  updateReviewDecision,
  updateReviewRequest,
  upsertChannelOutput
} from '../db.js';

/**
 * Wraps low-level SQLite functions in the shared store adapter interface.
 */
export function createSqliteStore(db, { databasePath = ':memory:' } = {}) {
  return {
    provider: 'sqlite',
    label: 'SQLite local fallback',
    location: databasePath,
    db,

    /**
     * Closes the underlying SQLite handle.
     */
    async close() {
      db.close();
    },

    /**
     * Runs a group of store writes in a SQLite transaction.
     */
    async withTransaction(callback) {
      db.exec('BEGIN');
      try {
        const result = await callback();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    /**
     * Loads one content item by ID.
     */
    async getContentItem(id) {
      return getContentItem(db, id);
    },

    /**
     * Loads one content item by duplicate-detection fingerprint.
     */
    async getContentItemByFingerprint(sourceFingerprint) {
      return getContentItemByFingerprint(db, sourceFingerprint);
    },

    /**
     * Inserts a collected content item.
     */
    async insertContentItem(input) {
      return insertContentItem(db, input);
    },

    /**
     * Appends an audit event.
     */
    async insertEvent(input) {
      return insertEvent(db, input);
    },

    /**
     * Lists content items by lifecycle status.
     */
    async listContentItemsByStatus(status, options) {
      return listContentItemsByStatus(db, status, options);
    },

    /**
     * Lists content items in the order Notion should mirror them.
     */
    async listContentItemsForNotionSync(options) {
      return listContentItemsForNotionSync(db, options);
    },

    /**
     * Stores draft fields for a content item.
     */
    async updateContentDraft(input) {
      return updateContentDraft(db, input);
    },

    /**
     * Stores review request metadata.
     */
    async updateReviewRequest(input) {
      return updateReviewRequest(db, input);
    },

    /**
     * Stores review approval or rejection metadata.
     */
    async updateReviewDecision(input) {
      return updateReviewDecision(db, input);
    },

    /**
     * Updates the content lifecycle status.
     */
    async updateContentStatus(input) {
      return updateContentStatus(db, input);
    },

    /**
     * Stores Notion mirror metadata.
     */
    async updateContentNotionSync(input) {
      return updateContentNotionSync(db, input);
    },

    /**
     * Inserts or updates a channel output row.
     */
    async upsertChannelOutput(input) {
      return upsertChannelOutput(db, input);
    },

    /**
     * Lists generated channel outputs ready for rendering.
     */
    async listChannelOutputsReadyToRender(options) {
      return listChannelOutputsReadyToRender(db, options);
    },

    /**
     * Lists publish-pending channel outputs ready for publishing.
     */
    async listChannelOutputsReadyToPublish(options) {
      return listChannelOutputsReadyToPublish(db, options);
    },

    /**
     * Claims one publish-pending channel output before an external publish call.
     */
    async claimChannelOutputForPublish(input) {
      return claimChannelOutputForPublish(db, input);
    },

    /**
     * Stores a render or upload artifact path.
     */
    async updateChannelOutputArtifact(input) {
      return updateChannelOutputArtifact(db, input);
    },

    /**
     * Stores the published URL for a channel output.
     */
    async updateChannelOutputPublished(input) {
      return updateChannelOutputPublished(db, input);
    },

    /**
     * Stores a failed channel publish attempt.
     */
    async updateChannelOutputFailure(input) {
      return updateChannelOutputFailure(db, input);
    },

    /**
     * Summarizes local pipeline status.
     */
    async summarize() {
      return summarize(db);
    }
  };
}

/**
 * Opens and migrates the configured SQLite database store.
 */
export function openSqliteStore(config) {
  const databasePath = databasePathFromUrl(config.databaseUrl, config.cwd);
  const db = openDatabase(databasePath);
  migrate(db);
  return createSqliteStore(db, { databasePath });
}
