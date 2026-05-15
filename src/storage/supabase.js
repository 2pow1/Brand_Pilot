import { basename, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const MIME_TYPES = Object.freeze({
  '.json': 'application/json',
  '.png': 'image/png'
});

/**
 * Normalizes Supabase URLs before constructing REST and public object paths.
 */
function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

/**
 * Fails fast when a required Supabase Storage setting is missing.
 */
function requireConfigValue(config, key, label) {
  if (!config[key]) {
    throw new Error(`${label} is required for Supabase Storage upload`);
  }
}

/**
 * Encodes each path segment while preserving Supabase Storage folder separators.
 */
function encodeObjectPath(value) {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/**
 * Builds the public URL that Instagram can fetch for an uploaded object.
 */
function publicObjectUrl({ config, bucket, objectPath }) {
  return `${trimTrailingSlash(config.supabaseUrl)}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`;
}

/**
 * Builds the authenticated Storage API URL used for uploads.
 */
function storageObjectUrl({ config, bucket, objectPath }) {
  return `${trimTrailingSlash(config.supabaseUrl)}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`;
}

/**
 * Chooses a supported MIME type for rendered Instagram artifacts.
 */
function contentTypeFor(path) {
  const lower = path.toLowerCase();
  const extension = lower.slice(lower.lastIndexOf('.'));
  return MIME_TYPES[extension] || 'application/octet-stream';
}

/**
 * Resolves a rendered artifact directory or manifest path into manifest.json.
 */
function localManifestPath(artifactPath) {
  if (!artifactPath) {
    throw new Error('Instagram upload requires a rendered artifact path');
  }

  return artifactPath.endsWith('.json') ? artifactPath : join(artifactPath, 'manifest.json');
}

/**
 * Checks whether an artifact path is already a public remote URL.
 */
function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

/**
 * Reads the local render manifest, tolerating the UTF-8 BOM emitted by Windows tooling.
 */
function readManifest(artifactPath) {
  const manifestPath = localManifestPath(artifactPath);

  if (!existsSync(manifestPath)) {
    throw new Error(`Rendered manifest not found: ${manifestPath}`);
  }

  const manifestText = readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '');

  return {
    manifestPath,
    manifest: JSON.parse(manifestText)
  };
}

/**
 * Extracts a local slide file path from either a string or manifest object entry.
 */
function normalizeSlidePath(slide) {
  if (typeof slide === 'string') return slide;
  return slide.localPath || slide.path || slide.filePath || '';
}

/**
 * Builds the deterministic Storage object path for one rendered artifact file.
 */
function buildStoragePath({ row, fileName }) {
  const contentItemId = row.id;
  const channelOutputId = row.channel_output_id || 'channel';
  return `instagram/${contentItemId}/${channelOutputId}/${fileName}`;
}

/**
 * Uploads one object to Supabase Storage with upsert semantics.
 */
export async function uploadStorageObject({ config, bucket, objectPath, body, contentType, fetchImpl = fetch }) {
  requireConfigValue(config, 'supabaseUrl', 'SUPABASE_URL');
  requireConfigValue(config, 'supabaseServiceRoleKey', 'SUPABASE_SERVICE_ROLE_KEY');

  const response = await fetchImpl(storageObjectUrl({ config, bucket, objectPath }), {
    method: 'POST',
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      'Content-Type': contentType,
      'cache-control': '31536000',
      'x-upsert': 'true'
    },
    body
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Supabase Storage upload failed: HTTP ${response.status}`);
  }

  return text ? JSON.parse(text) : {};
}

/**
 * Uploads rendered Instagram slides and writes a public manifest for publishing.
 */
export async function uploadInstagramRenderArtifact({ config, row, payload, fetchImpl = fetch }) {
  if (isHttpUrl(row.channel_artifact_path)) {
    return {
      uploaded: false,
      bucket: config.supabaseStorageBucket,
      manifestPublicUrl: row.channel_artifact_path,
      slides: []
    };
  }

  const bucket = config.supabaseStorageBucket;
  if (!bucket) {
    throw new Error('SUPABASE_STORAGE_BUCKET is required for Instagram artifact upload');
  }

  const { manifestPath, manifest } = readManifest(row.channel_artifact_path);
  const slidePaths = (manifest.slides || []).map(normalizeSlidePath).filter(Boolean);

  if (slidePaths.length === 0) {
    throw new Error(`Rendered manifest has no slides: ${manifestPath}`);
  }

  const uploadedSlides = [];
  for (let index = 0; index < slidePaths.length; index += 1) {
    const slidePath = slidePaths[index];
    if (!existsSync(slidePath)) {
      throw new Error(`Rendered slide not found: ${slidePath}`);
    }

    const fileName = basename(slidePath);
    const objectPath = buildStoragePath({ row, fileName });

    await uploadStorageObject({
      config,
      bucket,
      objectPath,
      body: readFileSync(slidePath),
      contentType: contentTypeFor(slidePath),
      fetchImpl
    });

    uploadedSlides.push({
      index: index + 1,
      fileName,
      objectPath,
      publicUrl: publicObjectUrl({ config, bucket, objectPath })
    });
  }

  const manifestObjectPath = buildStoragePath({ row, fileName: 'manifest.json' });
  const publicManifest = {
    ...manifest,
    outputDir: publicObjectUrl({
      config,
      bucket,
      objectPath: buildStoragePath({ row, fileName: '' }).replace(/\/$/, '')
    }),
    slides: uploadedSlides,
    caption: manifest.caption || payload.caption || '',
    hashtags: manifest.hashtags || payload.hashtags || [],
    uploadedAt: new Date().toISOString(),
    storage: {
      bucket,
      manifestObjectPath
    }
  };

  await uploadStorageObject({
    config,
    bucket,
    objectPath: manifestObjectPath,
    body: Buffer.from(JSON.stringify(publicManifest, null, 2), 'utf8'),
    contentType: 'application/json',
    fetchImpl
  });

  return {
    uploaded: true,
    bucket,
    manifestPath,
    manifestObjectPath,
    manifestPublicUrl: publicObjectUrl({ config, bucket, objectPath: manifestObjectPath }),
    slides: uploadedSlides
  };
}
