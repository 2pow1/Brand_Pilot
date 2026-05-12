import { createHash, randomUUID } from 'node:crypto';

export function createId(prefix) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

export function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex');
}
