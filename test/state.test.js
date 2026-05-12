import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertContentTransition, CONTENT_STATUSES } from '../src/state.js';

test('allows the main approved content path', () => {
  assert.doesNotThrow(() => {
    assertContentTransition(CONTENT_STATUSES.COLLECTED, CONTENT_STATUSES.DRAFT_CREATED);
    assertContentTransition(CONTENT_STATUSES.DRAFT_CREATED, CONTENT_STATUSES.PENDING_REVIEW);
    assertContentTransition(CONTENT_STATUSES.PENDING_REVIEW, CONTENT_STATUSES.APPROVED);
    assertContentTransition(CONTENT_STATUSES.APPROVED, CONTENT_STATUSES.CHANNEL_GENERATED);
    assertContentTransition(CONTENT_STATUSES.CHANNEL_GENERATED, CONTENT_STATUSES.PUBLISH_PENDING);
    assertContentTransition(CONTENT_STATUSES.PUBLISH_PENDING, CONTENT_STATUSES.PUBLISHED);
  });
});

test('allows rejection only from pending review', () => {
  assert.doesNotThrow(() => {
    assertContentTransition(CONTENT_STATUSES.PENDING_REVIEW, CONTENT_STATUSES.REJECTED);
  });

  assert.throws(
    () => assertContentTransition(CONTENT_STATUSES.COLLECTED, CONTENT_STATUSES.REJECTED),
    /Invalid content transition/
  );
});
