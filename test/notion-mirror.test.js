import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkNotionDataSource, syncContentItemToNotion } from '../src/notion/mirror.js';

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
  notion_page_id: '',
  notion_channel_id: 'instagram',
  notion_channel_status: 'published',
  notion_channel_payload_json: JSON.stringify({
    caption: 'Instagram caption',
    hashtags: ['#brand', '#marketing'],
    slides: [{ index: 1 }, { index: 2 }, { index: 3 }]
  }),
  notion_channel_artifact_path: 'https://storage.example.com/manifest.json',
  notion_channel_published_url: 'https://www.instagram.com/p/shortcode/',
  notion_channel_last_error: ''
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
  assert.equal(calls[0].body.properties.Channel.rich_text[0].text.content, 'instagram');
  assert.equal(calls[0].body.properties['Channel Status'].rich_text[0].text.content, 'published');
  assert.equal(calls[0].body.properties.Caption.rich_text[0].text.content, 'Instagram caption');
  assert.equal(calls[0].body.properties.Hashtags.rich_text[0].text.content, '#brand #marketing');
  assert.equal(calls[0].body.properties['Slide Count'].number, 3);
  assert.equal(calls[0].body.properties['Artifact URL'].url, 'https://storage.example.com/manifest.json');
  assert.equal(calls[0].body.properties['Published URL'].url, 'https://www.instagram.com/p/shortcode/');
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

test('checks Notion data source properties', async () => {
  const result = await checkNotionDataSource({
    config,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.notion.com/v1/data_sources/data-source-id');
      assert.equal(options.headers.Authorization, 'Bearer notion-token');

      return Response.json({
        id: 'data-source-id',
        title: [{ plain_text: 'Brand Pilot Mirror' }],
        properties: {
          Name: { type: 'title' },
          'Content ID': { type: 'rich_text' },
          Status: { type: 'rich_text' },
          Source: { type: 'rich_text' },
          'Source URL': { type: 'url' },
          Draft: { type: 'rich_text' },
          'Review Message': { type: 'rich_text' },
          'Rejection Reason': { type: 'rich_text' },
          Channel: { type: 'rich_text' },
          'Channel Status': { type: 'rich_text' },
          Caption: { type: 'rich_text' },
          Hashtags: { type: 'rich_text' },
          'Slide Count': { type: 'number' },
          'Artifact URL': { type: 'url' },
          'Published URL': { type: 'url' },
          'Channel Last Error': { type: 'rich_text' },
          'Updated At': { type: 'date' }
        }
      });
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.title, 'Brand Pilot Mirror');
  assert.equal(result.missing.length, 0);
});

test('reports missing Notion data source properties', async () => {
  const result = await checkNotionDataSource({
    config,
    fetchImpl: async () =>
      Response.json({
        id: 'data-source-id',
        properties: {
          Name: { type: 'title' },
          Status: { type: 'status' }
        }
      })
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing.map((property) => property.name), [
    'Content ID',
    'Status',
    'Source',
    'Source URL',
    'Draft',
    'Review Message',
    'Rejection Reason',
    'Channel',
    'Channel Status',
    'Caption',
    'Hashtags',
    'Slide Count',
    'Artifact URL',
    'Published URL',
    'Channel Last Error',
    'Updated At'
  ]);
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
