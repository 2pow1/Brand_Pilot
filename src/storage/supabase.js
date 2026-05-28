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
 * Builds the authenticated Storage API URL used for bulk deletion.
 */
function storageBucketObjectUrl({ config, bucket }) {
  return `${trimTrailingSlash(config.supabaseUrl)}/storage/v1/object/${encodeURIComponent(bucket)}`;
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
 * Returns the Storage object prefix that belongs to one Instagram channel output.
 */
function buildStoragePrefix(row) {
  return buildStoragePath({ row, fileName: '' });
}

/**
 * Extracts a Supabase Storage object path from a public object URL.
 */
export function objectPathFromPublicUrl({ config, bucket, publicUrl }) {
  if (!isHttpUrl(publicUrl)) return '';

  let parsed;
  try {
    parsed = new URL(publicUrl);
  } catch {
    return '';
  }

  const expectedBase = new URL(trimTrailingSlash(config.supabaseUrl));
  if (parsed.origin !== expectedBase.origin) {
    return '';
  }

  const bucketPrefix = `/storage/v1/object/public/${bucket}/`;
  const encodedBucketPrefix = `/storage/v1/object/public/${encodeURIComponent(bucket)}/`;
  const path = parsed.pathname;
  const prefix = path.startsWith(bucketPrefix)
    ? bucketPrefix
    : path.startsWith(encodedBucketPrefix)
      ? encodedBucketPrefix
      : '';

  if (!prefix) return '';

  return path
    .slice(prefix.length)
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/');
}

/**
 * Fetches a public render manifest from Supabase Storage.
 */
async function fetchPublicManifest({ manifestUrl, fetchImpl = fetch }) {
  const response = await fetchImpl(manifestUrl);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Failed to fetch Supabase Storage manifest: HTTP ${response.status}`);
  }

  return JSON.parse(text.replace(/^\uFEFF/, ''));
}

/**
 * Builds the object path set that can be safely deleted for one backed-up artifact.
 */
export function buildInstagramCleanupObjectPaths({ config, bucket, row, manifestUrl, manifest }) {
  const expectedPrefix = buildStoragePrefix(row);
  const paths = new Set();
  const addPath = (objectPath) => {
    if (!objectPath) return;
    if (!objectPath.startsWith(expectedPrefix)) {
      throw new Error(`Refusing to delete object outside expected prefix: ${objectPath}`);
    }
    paths.add(objectPath);
  };

  addPath(manifest.storage?.manifestObjectPath);
  addPath(objectPathFromPublicUrl({ config, bucket, publicUrl: manifestUrl }));

  for (const slide of manifest.slides || []) {
    if (typeof slide === 'string') {
      addPath(objectPathFromPublicUrl({ config, bucket, publicUrl: slide }));
      continue;
    }

    addPath(slide.objectPath);
    addPath(objectPathFromPublicUrl({ config, bucket, publicUrl: slide.publicUrl || slide.url || slide.imageUrl }));
  }

  return [...paths];
}

/**
 * Deletes Supabase Storage objects through the Storage API.
 */
export async function deleteStorageObjects({ config, bucket, objectPaths, fetchImpl = fetch }) {
  requireConfigValue(config, 'supabaseUrl', 'SUPABASE_URL');
  requireConfigValue(config, 'supabaseServiceRoleKey', 'SUPABASE_SERVICE_ROLE_KEY');

  if (objectPaths.length === 0) {
    return [];
  }

  if (objectPaths.length > 1000) {
    throw new Error('Supabase Storage delete supports at most 1000 objects per request');
  }

  const response = await fetchImpl(storageBucketObjectUrl({ config, bucket }), {
    method: 'DELETE',
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prefixes: objectPaths
    })
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Supabase Storage delete failed: HTTP ${response.status}`);
  }

  return text ? JSON.parse(text) : [];
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

/**
 * Deletes a backed-up Instagram render artifact from Supabase Storage.
 */
export async function cleanupInstagramRenderArtifact({ config, row, dryRun = true, fetchImpl = fetch }) {
  const bucket = config.supabaseStorageBucket;
  if (!bucket) {
    throw new Error('SUPABASE_STORAGE_BUCKET is required for Supabase Storage cleanup');
  }

  const manifestUrl = row.channel_artifact_path;
  if (!isHttpUrl(manifestUrl)) {
    throw new Error('Storage cleanup requires a public Supabase Storage manifest URL');
  }

  const manifest = await fetchPublicManifest({
    manifestUrl,
    fetchImpl
  });
  const objectPaths = buildInstagramCleanupObjectPaths({
    config,
    bucket,
    row,
    manifestUrl,
    manifest
  });

  if (objectPaths.length === 0) {
    throw new Error('Storage cleanup found no object paths in the render manifest');
  }

  if (dryRun) {
    return {
      dryRun: true,
      bucket,
      manifestUrl,
      objectPaths,
      deletedCount: 0
    };
  }

  const deleted = await deleteStorageObjects({
    config,
    bucket,
    objectPaths,
    fetchImpl
  });

  return {
    dryRun: false,
    bucket,
    manifestUrl,
    objectPaths,
    deleted,
    deletedCount: objectPaths.length
  };
}
