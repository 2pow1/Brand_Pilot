import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSupabaseStore } from '../src/database/supabase-store.js';

function createJsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function createStore() {
  return createSupabaseStore({
    supabaseUrl: 'https://project.supabase.co',
    supabaseServiceRoleKey: 'service-role-key'
  });
}

test('requires Supabase credentials', () => {
  assert.throws(
    () => createSupabaseStore({ supabaseUrl: '', supabaseServiceRoleKey: '' }),
    /SUPABASE_URL is required/
  );
});

test('inserts content and event rows through Supabase REST', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({
      url: String(url),
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body ? JSON.parse(options.body) : null
    });

    if (String(url).endsWith('/rest/v1/content_items')) {
      return createJsonResponse([{ id: 'content_123', ...JSON.parse(options.body) }], 201);
    }

    if (String(url).endsWith('/rest/v1/events')) {
      return new Response('', { status: 201 });
    }

    return createJsonResponse({ message: 'unexpected request' }, 500);
  };

  try {
    const store = createStore();
    const row = await store.insertContentItem({
      id: 'content_123',
      sourceId: 'source-a',
      sourceName: 'Source A',
      sourceUrl: 'https://example.com/article',
      sourceTitle: 'Article',
      sourceFingerprint: 'fingerprint',
      rawExcerpt: 'Excerpt',
      status: 'collected'
    });

    assert.equal(row.id, 'content_123');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].headers.Authorization, 'Bearer service-role-key');
    assert.equal(calls[0].body.source_fingerprint, 'fingerprint');
    assert.equal(calls[1].body.event_type, 'content.created');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('summarizes Supabase status rows', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = String(url);

    if (value.includes('/content_items')) {
      return createJsonResponse([
        { status: 'collected' },
        { status: 'collected' },
        { status: 'pending_review' }
      ]);
    }

    if (value.includes('/channel_outputs')) {
      return createJsonResponse([{ status: 'generated' }]);
    }

    if (value.includes('/events')) {
      return createJsonResponse([
        {
          id: 1,
          content_item_id: 'content_123',
          event_type: 'content.created',
          created_at: '2026-05-12T00:00:00.000Z'
        }
      ]);
    }

    return createJsonResponse({ message: 'unexpected request' }, 500);
  };

  try {
    const store = createStore();
    const summary = await store.summarize();

    assert.deepEqual(summary.contentByStatus, [
      { status: 'collected', count: 2 },
      { status: 'pending_review', count: 1 }
    ]);
    assert.deepEqual(summary.channelsByStatus, [{ status: 'generated', count: 1 }]);
    assert.equal(summary.recentEvents[0].event_type, 'content.created');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
