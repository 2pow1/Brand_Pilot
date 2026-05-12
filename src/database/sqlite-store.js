import { databasePathFromUrl } from '../config.js';
import {
  getContentItem,
  getContentItemByFingerprint,
  insertEvent,
  insertContentItem,
  listChannelOutputsReadyToRender,
  listChannelOutputsReadyToPublish,
  listContentItemsByStatus,
  migrate,
  openDatabase,
  summarize,
  updateChannelOutputArtifact,
  updateChannelOutputPublished,
  updateContentDraft,
  updateContentStatus,
  updateReviewDecision,
  updateReviewRequest,
  upsertChannelOutput
} from '../db.js';

export function createSqliteStore(db, { databasePath = ':memory:' } = {}) {
  return {
    provider: 'sqlite',
    label: 'SQLite local fallback',
    location: databasePath,
    db,

    async close() {
      db.close();
    },

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

    async getContentItem(id) {
      return getContentItem(db, id);
    },

    async getContentItemByFingerprint(sourceFingerprint) {
      return getContentItemByFingerprint(db, sourceFingerprint);
    },

    async insertContentItem(input) {
      return insertContentItem(db, input);
    },

    async insertEvent(input) {
      return insertEvent(db, input);
    },

    async listContentItemsByStatus(status, options) {
      return listContentItemsByStatus(db, status, options);
    },

    async updateContentDraft(input) {
      return updateContentDraft(db, input);
    },

    async updateReviewRequest(input) {
      return updateReviewRequest(db, input);
    },

    async updateReviewDecision(input) {
      return updateReviewDecision(db, input);
    },

    async updateContentStatus(input) {
      return updateContentStatus(db, input);
    },

    async upsertChannelOutput(input) {
      return upsertChannelOutput(db, input);
    },

    async listChannelOutputsReadyToRender(options) {
      return listChannelOutputsReadyToRender(db, options);
    },

    async listChannelOutputsReadyToPublish(options) {
      return listChannelOutputsReadyToPublish(db, options);
    },

    async updateChannelOutputArtifact(input) {
      return updateChannelOutputArtifact(db, input);
    },

    async updateChannelOutputPublished(input) {
      return updateChannelOutputPublished(db, input);
    },

    async summarize() {
      return summarize(db);
    }
  };
}

export function openSqliteStore(config) {
  const databasePath = databasePathFromUrl(config.databaseUrl, config.cwd);
  const db = openDatabase(databasePath);
  migrate(db);
  return createSqliteStore(db, { databasePath });
}
