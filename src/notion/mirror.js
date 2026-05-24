const MAX_RICH_TEXT_LENGTH = 1900;
const REQUIRED_DATA_SOURCE_PROPERTIES = Object.freeze({
  Name: 'title',
  'Content ID': 'rich_text',
  Status: 'rich_text',
  Source: 'rich_text',
  'Source URL': 'url',
  Draft: 'rich_text',
  'Review Message': 'rich_text',
  'Rejection Reason': 'rich_text',
  Channel: 'rich_text',
  'Channel Status': 'rich_text',
  Caption: 'rich_text',
  Hashtags: 'rich_text',
  'Slide Count': 'number',
  'Artifact URL': 'url',
  'Published URL': 'url',
  'Channel Last Error': 'rich_text',
  'Updated At': 'date'
});

/**
 * Normalizes Notion API base URLs before appending endpoint paths.
 */
function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

/**
 * Fails fast when a required Notion integration setting is missing.
 */
function requireConfigValue(config, key, label) {
  if (!config[key]) {
    throw new Error(`${label} is required for Notion sync`);
  }
}

/**
 * Trims text to Notion rich-text limits while preserving the start of the content.
 */
function truncate(value, maxLength = MAX_RICH_TEXT_LENGTH) {
  const normalized = String(value || '').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}...`;
}

/**
 * Builds a Notion title property payload.
 */
function titleProperty(value) {
  return {
    title: [
      {
        text: {
          content: truncate(value || 'Untitled content', 120)
        }
      }
    ]
  };
}

/**
 * Builds a Notion rich text property payload.
 */
function richTextProperty(value) {
  return {
    rich_text: [
      {
        text: {
          content: truncate(value)
        }
      }
    ]
  };
}

/**
 * Builds a Notion URL property payload.
 */
function urlProperty(value) {
  return {
    url: value || null
  };
}

/**
 * Builds a Notion date property payload.
 */
function dateProperty(value) {
  return {
    date: value ? { start: value } : null
  };
}

/**
 * Builds a Notion number property payload.
 */
function numberProperty(value) {
  return {
    number: Number.isFinite(value) ? value : null
  };
}

/**
 * Parses a JSON string or object without failing the whole Notion sync.
 */
function parseJsonPayload(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/**
 * Extracts channel-specific backup fields from a flattened content row.
 */
function channelBackupFields(item) {
  const payload = parseJsonPayload(item.notion_channel_payload_json);
  const slides = Array.isArray(payload.slides) ? payload.slides : [];
  const hashtags = Array.isArray(payload.hashtags) ? payload.hashtags.join(' ') : '';

  return {
    channelId: item.notion_channel_id || payload.channelId || '',
    channelStatus: item.notion_channel_status || '',
    caption: payload.caption || '',
    hashtags,
    slideCount: slides.length,
    artifactUrl: item.notion_channel_artifact_path || '',
    publishedUrl: item.notion_channel_published_url || '',
    lastError: item.notion_channel_last_error || ''
  };
}

/**
 * Maps a content item row into the configured Notion data source properties.
 */
function buildPageProperties(item) {
  const channel = channelBackupFields(item);

  return {
    Name: titleProperty(item.draft_title || item.source_title),
    'Content ID': richTextProperty(item.id),
    Status: richTextProperty(item.status),
    Source: richTextProperty(item.source_name),
    'Source URL': urlProperty(item.source_url),
    Draft: richTextProperty(item.draft_body),
    'Review Message': richTextProperty(item.review_message_id),
    'Rejection Reason': richTextProperty(item.rejection_reason),
    Channel: richTextProperty(channel.channelId),
    'Channel Status': richTextProperty(channel.channelStatus),
    Caption: richTextProperty(channel.caption),
    Hashtags: richTextProperty(channel.hashtags),
    'Slide Count': numberProperty(channel.slideCount),
    'Artifact URL': urlProperty(channel.artifactUrl),
    'Published URL': urlProperty(channel.publishedUrl),
    'Channel Last Error': richTextProperty(channel.lastError),
    'Updated At': dateProperty(item.updated_at)
  };
}

/**
 * Sends an authenticated Notion API request and returns the JSON payload.
 */
async function notionRequest({ config, path, method = 'GET', body, fetchImpl = fetch }) {
  requireConfigValue(config, 'notionToken', 'NOTION_TOKEN');
  requireConfigValue(config, 'notionDataSourceId', 'NOTION_DATA_SOURCE_ID');

  const response = await fetchImpl(`${trimTrailingSlash(config.notionBaseUrl)}/${path.replace(/^\/+/, '')}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': config.notionVersion
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || `Notion request failed: HTTP ${response.status}`);
  }

  return payload;
}

/**
 * Checks whether the configured Notion data source has the properties Brand Pilot writes.
 */
export async function checkNotionDataSource({ config, fetchImpl = fetch }) {
  const dataSource = await notionRequest({
    config,
    path: `data_sources/${config.notionDataSourceId}`,
    fetchImpl
  });
  const properties = dataSource.properties || {};
  const results = Object.entries(REQUIRED_DATA_SOURCE_PROPERTIES).map(([name, expectedType]) => {
    const actualType = properties[name]?.type || '';
    const ok = actualType === expectedType;

    return {
      name,
      expectedType,
      actualType,
      ok
    };
  });
  const missing = results.filter((result) => !result.ok);

  return {
    ok: missing.length === 0,
    dataSourceId: dataSource.id || config.notionDataSourceId,
    title: dataSource.title?.[0]?.plain_text || dataSource.name || '',
    missing,
    properties: results
  };
}

/**
 * Creates or updates the Notion mirror page for one content item.
 */
export async function syncContentItemToNotion({ config, item, fetchImpl = fetch }) {
  const properties = buildPageProperties(item);

  if (item.notion_page_id) {
    const page = await notionRequest({
      config,
      path: `pages/${item.notion_page_id}`,
      method: 'PATCH',
      body: {
        properties
      },
      fetchImpl
    });

    return {
      pageId: page.id || item.notion_page_id,
      action: 'updated',
      url: page.url || ''
    };
  }

  const page = await notionRequest({
    config,
    path: 'pages',
    method: 'POST',
    body: {
      parent: {
        data_source_id: config.notionDataSourceId
      },
      properties
    },
    fetchImpl
  });

  return {
    pageId: page.id,
    action: 'created',
    url: page.url || ''
  };
}
