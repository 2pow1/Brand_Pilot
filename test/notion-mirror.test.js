import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syncContentItemToNotion } from '../src/notion/mirror.js';

const config = {
  notionToken: 'notion-token',
  notionDataSourceId: 'data-source-id',
  notionBaseUrl: 'https://api.notion.com/v1',
  notionVersion: '2026-03-11'
};

const item = {
  id: 'content_123',
  source_name: 'Source',
  source_title: 'Source title',
  source_url: 'https://example.com/article',
  status: 'pending_review',
  draft_title: 'Draft title',
  draft_body: 'Draft body',
  review_message_id: 'message_123',
  rejection_reason: '',
  updated_at: '2026-05-13T00:00:00.000Z',
  notion_page_id: ''
};

test('creates a Notion page for unsynced content', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({
      url,
      method: options.method,
      headers: options.headers,
      body: JSON.parse(options.body)
    });

    return Response.json({
      id: 'page_123',
      url: 'https://notion.so/page_123'
    });
  };
  const result = await syncContentItemToNotion({
    config,
    item,
    fetchImpl
  });

  assert.equal(result.action, 'created');
  assert.equal(result.pageId, 'page_123');
  assert.equal(calls[0].url, 'https://api.notion.com/v1/pages');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers.Authorization, 'Bearer notion-token');
  assert.equal(calls[0].headers['Notion-Version'], '2026-03-11');
  assert.equal(calls[0].body.parent.data_source_id, 'data-source-id');
  assert.equal(calls[0].body.properties.Name.title[0].text.content, 'Draft title');
  assert.equal(calls[0].body.properties.Status.rich_text[0].text.content, 'pending_review');
});

test('updates a Notion page for already synced content', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({
      url,
      method: options.method,
      body: JSON.parse(options.body)
    });

    return Response.json({
      id: 'page_existing',
      url: 'https://notion.so/page_existing'
    });
  };
  const result = await syncContentItemToNotion({
    config,
    item: {
      ...item,
      notion_page_id: 'page_existing'
    },
    fetchImpl
  });

  assert.equal(result.action, 'updated');
  assert.equal(calls[0].url, 'https://api.notion.com/v1/pages/page_existing');
  assert.equal(calls[0].method, 'PATCH');
  assert.equal(calls[0].body.properties['Content ID'].rich_text[0].text.content, 'content_123');
});

test('requires Notion credentials', async () => {
  await assert.rejects(
    () =>
      syncContentItemToNotion({
        config: {
          ...config,
          notionToken: ''
        },
        item
      }),
    /NOTION_TOKEN is required/
  );
});
