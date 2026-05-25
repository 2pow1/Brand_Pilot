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
  'Backup Status': 'rich_text',
  'Backup Completed At': 'date',
  'Backup File Count': 'number',
  'Backup Last Error': 'rich_text',
  'Artifact Files': 'files',
  'Updated At': 'date'
});
const BACKUP_MAX_POLLS = 10;
const BACKUP_POLL_INTERVAL_MS = 1000;

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
 * Builds a Notion files property payload from uploaded Notion file IDs.
 */
function filesProperty(files) {
  return {
    files: files.map((file) => ({
      name: file.filename,
      type: 'file_upload',
      file_upload: {
        id: file.id
      }
    }))
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
  const backupPayload = parseJsonPayload(item.notion_channel_backup_payload_json);
  const slides = Array.isArray(payload.slides) ? payload.slides : [];
  const hashtags = Array.isArray(payload.hashtags) ? payload.hashtags.join(' ') : '';
  const backupFiles = Array.isArray(backupPayload.files) ? backupPayload.files : [];

  return {
    channelId: item.notion_channel_id || payload.channelId || '',
    channelStatus: item.notion_channel_status || '',
    caption: payload.caption || '',
    hashtags,
    slideCount: slides.length,
    artifactUrl: item.notion_channel_artifact_path || '',
    publishedUrl: item.notion_channel_published_url || '',
    lastError: item.notion_channel_last_error || '',
    backupStatus: item.notion_channel_backup_status || '',
    backupCompletedAt: item.notion_channel_backup_completed_at || '',
    backupFileCount: backupFiles.length || null,
    backupLastError: item.notion_channel_backup_error || ''
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
    'Backup Status': richTextProperty(channel.backupStatus),
    'Backup Completed At': dateProperty(channel.backupCompletedAt),
    'Backup File Count': numberProperty(channel.backupFileCount),
    'Backup Last Error': richTextProperty(channel.backupLastError),
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
 * Resolves after the requested delay so asynchronous Notion imports can be polled.
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Returns true when a string is an HTTP(S) URL usable by Notion external imports.
 */
function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

/**
 * Extracts a stable filename from a URL or falls back to the supplied name.
 */
function filenameFromUrl(url, fallback) {
  try {
    const parsed = new URL(url);
    const filename = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    return filename || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Chooses a MIME type for files imported from Supabase Storage into Notion.
 */
function contentTypeForFilename(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

/**
 * Fetches a JSON document and includes the source URL in any error.
 */
async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch Notion artifact manifest: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Normalizes an uploaded render manifest into the files that should be imported into Notion.
 */
function buildArtifactBackupFiles({ item, manifestUrl, manifest }) {
  const slides = Array.isArray(manifest.slides) ? manifest.slides : [];
  const files = [
    {
      role: 'manifest',
      url: manifestUrl,
      filename: `${item.id}-manifest.json`,
      contentType: 'application/json'
    }
  ];

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    const url = typeof slide === 'string' ? slide : slide.publicUrl || slide.url || slide.imageUrl || '';

    if (!isHttpUrl(url)) continue;

    const filename = filenameFromUrl(url, `${item.id}-slide-${String(index + 1).padStart(2, '0')}.png`);
    files.push({
      role: 'slide',
      url,
      filename,
      contentType: contentTypeForFilename(filename)
    });
  }

  if (files.length === 1) {
    throw new Error('Notion artifact backup requires at least one public slide URL in the manifest');
  }

  return files;
}

/**
 * Starts a Notion external URL import for one already public artifact.
 */
async function createExternalFileUpload({ config, file, fetchImpl }) {
  return notionRequest({
    config,
    path: 'file_uploads',
    method: 'POST',
    body: {
      mode: 'external_url',
      external_url: file.url,
      filename: file.filename,
      content_type: file.contentType
    },
    fetchImpl
  });
}

/**
 * Polls Notion until an external file import is uploaded or failed.
 */
async function waitForFileUpload({
  config,
  upload,
  fetchImpl,
  maxPolls = BACKUP_MAX_POLLS,
  pollIntervalMs = BACKUP_POLL_INTERVAL_MS,
  sleepImpl = sleep
}) {
  let current = upload;

  for (let attempt = 0; attempt <= maxPolls; attempt += 1) {
    if (current.status === 'uploaded') return current;
    if (current.status === 'failed') {
      const detail = current.file_import_result?.error?.message || current.request_status?.message || '';
      throw new Error(`Notion file import failed${detail ? `: ${detail}` : ''}`);
    }

    if (attempt === maxPolls) break;

    if (pollIntervalMs > 0) {
      await sleepImpl(pollIntervalMs);
    }

    current = await notionRequest({
      config,
      path: `file_uploads/${upload.id}`,
      fetchImpl
    });
  }

  throw new Error(`Notion file import did not complete in time: ${upload.id}`);
}

/**
 * Imports one external artifact URL into Notion-hosted file storage.
 */
async function importArtifactFile({ config, file, fetchImpl, maxPolls, pollIntervalMs, sleepImpl }) {
  const upload = await createExternalFileUpload({
    config,
    file,
    fetchImpl
  });
  const uploaded = await waitForFileUpload({
    config,
    upload,
    fetchImpl,
    maxPolls,
    pollIntervalMs,
    sleepImpl
  });

  return {
    id: uploaded.id,
    filename: uploaded.filename || file.filename,
    contentType: uploaded.content_type || file.contentType,
    sourceUrl: file.url,
    role: file.role
  };
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

/**
 * Imports uploaded Instagram render artifacts into Notion and attaches them to the mirror page.
 */
export async function backupNotionArtifactsForItem({
  config,
  item,
  fetchImpl = fetch,
  maxPolls = BACKUP_MAX_POLLS,
  pollIntervalMs = BACKUP_POLL_INTERVAL_MS,
  sleepImpl = sleep
}) {
  if (!item.notion_page_id) {
    throw new Error('Notion artifact backup requires a synced Notion page first');
  }

  const manifestUrl = item.channel_artifact_path || item.notion_channel_artifact_path || '';
  if (!isHttpUrl(manifestUrl)) {
    throw new Error('Notion artifact backup requires a public Supabase Storage manifest URL');
  }

  const manifest = await fetchJson(manifestUrl, fetchImpl);
  const files = buildArtifactBackupFiles({
    item,
    manifestUrl,
    manifest
  });
  const uploadedFiles = [];

  for (const file of files) {
    uploadedFiles.push(
      await importArtifactFile({
        config,
        file,
        fetchImpl,
        maxPolls,
        pollIntervalMs,
        sleepImpl
      })
    );
  }

  const backedUpAt = new Date().toISOString();
  const page = await notionRequest({
    config,
    path: `pages/${item.notion_page_id}`,
    method: 'PATCH',
    body: {
      properties: {
        'Artifact Files': filesProperty(uploadedFiles),
        'Backup Status': richTextProperty('backed_up'),
        'Backup Completed At': dateProperty(backedUpAt),
        'Backup File Count': numberProperty(uploadedFiles.length),
        'Backup Last Error': richTextProperty('')
      }
    },
    fetchImpl
  });

  return {
    pageId: page.id || item.notion_page_id,
    url: page.url || '',
    backedUpAt,
    manifestUrl,
    files: uploadedFiles
  };
}
