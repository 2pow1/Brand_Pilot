import { createHash, randomUUID } from 'node:crypto';

/**
 * Creates compact, prefixed IDs used by content and channel records.
 */
export function createId(prefix) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

/**
 * Builds a stable SHA-256 fingerprint for duplicate detection.
 */
export function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex');
}
