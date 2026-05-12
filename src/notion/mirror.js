const MAX_RICH_TEXT_LENGTH = 1900;

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function requireConfigValue(config, key, label) {
  if (!config[key]) {
    throw new Error(`${label} is required for Notion sync`);
  }
}

function truncate(value, maxLength = MAX_RICH_TEXT_LENGTH) {
  const normalized = String(value || '').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}...`;
}

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

function urlProperty(value) {
  return {
    url: value || null
  };
}

function dateProperty(value) {
  return {
    date: value ? { start: value } : null
  };
}

function buildPageProperties(item) {
  return {
    Name: titleProperty(item.draft_title || item.source_title),
    'Content ID': richTextProperty(item.id),
    Status: richTextProperty(item.status),
    Source: richTextProperty(item.source_name),
    'Source URL': urlProperty(item.source_url),
    Draft: richTextProperty(item.draft_body),
    'Review Message': richTextProperty(item.review_message_id),
    'Rejection Reason': richTextProperty(item.rejection_reason),
    'Updated At': dateProperty(item.updated_at)
  };
}

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
