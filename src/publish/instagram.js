import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIN_CAROUSEL_IMAGES = 2;
const MAX_CAROUSEL_IMAGES = 10;

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function assertConfig(config) {
  if (!config.metaAccessToken) {
    throw new Error('META_ACCESS_TOKEN is required to publish Instagram content');
  }

  if (!config.instagramBusinessAccountId) {
    throw new Error('INSTAGRAM_BUSINESS_ACCOUNT_ID is required to publish Instagram content');
  }
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function captionWithHashtags(payload, manifest) {
  const caption = manifest?.caption || payload.caption || '';
  const hashtags = unique([...(manifest?.hashtags || []), ...(payload.hashtags || [])]);

  if (hashtags.length === 0) {
    return caption;
  }

  return `${caption}\n\n${hashtags.join(' ')}`.trim();
}

function collectUrlsFromSlides(slides = []) {
  return slides
    .map((slide) => {
      if (typeof slide === 'string') return slide;
      return slide.publicUrl || slide.public_url || slide.imageUrl || slide.image_url || slide.url || '';
    })
    .filter(isHttpUrl);
}

function readLocalManifest(artifactPath) {
  if (!artifactPath) return null;
  const manifestPath = artifactPath.endsWith('.json') ? artifactPath : join(artifactPath, 'manifest.json');

  if (!existsSync(manifestPath)) return null;

  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

async function fetchRemoteManifest(artifactPath, fetchImpl) {
  if (!isHttpUrl(artifactPath)) return null;
  const manifestUrl = artifactPath.endsWith('.json') ? artifactPath : `${artifactPath.replace(/\/+$/, '')}/manifest.json`;
  const response = await fetchImpl(manifestUrl);

  if (!response.ok) {
    throw new Error(`Failed to load Instagram render manifest: HTTP ${response.status}`);
  }

  return response.json();
}

export async function loadInstagramPublishInput({ row, payload, fetchImpl = fetch }) {
  const artifactPath = row.channel_artifact_path || '';
  const manifest = isHttpUrl(artifactPath)
    ? await fetchRemoteManifest(artifactPath, fetchImpl)
    : readLocalManifest(artifactPath);
  const imageUrls = unique([
    ...(payload.publish?.imageUrls || []),
    ...(payload.imageUrls || []),
    ...collectUrlsFromSlides(payload.slides),
    ...collectUrlsFromSlides(manifest?.slides)
  ]);

  if (imageUrls.length === 0) {
    throw new Error(
      'Instagram publishing requires public image URLs. Rendered local PNG files must be uploaded to public storage first.'
    );
  }

  return {
    imageUrls,
    caption: captionWithHashtags(payload, manifest),
    manifest
  };
}

async function graphPost({ config, path, params, fetchImpl = fetch }) {
  const url = `${trimTrailingSlash(config.metaGraphBaseUrl)}/${path.replace(/^\/+/, '')}`;
  const body = new URLSearchParams({
    ...params,
    access_token: config.metaAccessToken
  });
  const response = await fetchImpl(url, {
    method: 'POST',
    body
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || `Instagram Graph API request failed: HTTP ${response.status}`);
  }

  return payload;
}

async function graphGet({ config, path, params = {}, fetchImpl = fetch }) {
  const url = new URL(`${trimTrailingSlash(config.metaGraphBaseUrl)}/${path.replace(/^\/+/, '')}`);
  for (const [key, value] of Object.entries({
    ...params,
    access_token: config.metaAccessToken
  })) {
    url.searchParams.set(key, value);
  }
  const response = await fetchImpl(url);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || `Instagram Graph API request failed: HTTP ${response.status}`);
  }

  return payload;
}

async function createImageContainer({ config, imageUrl, carouselItem, caption, fetchImpl }) {
  const params = {
    image_url: imageUrl
  };

  if (carouselItem) {
    params.is_carousel_item = 'true';
  } else if (caption) {
    params.caption = caption;
  }

  const payload = await graphPost({
    config,
    path: `${config.instagramBusinessAccountId}/media`,
    params,
    fetchImpl
  });

  if (!payload.id) {
    throw new Error('Instagram media container response did not include an id');
  }

  return payload.id;
}

async function createCarouselContainer({ config, children, caption, fetchImpl }) {
  const payload = await graphPost({
    config,
    path: `${config.instagramBusinessAccountId}/media`,
    params: {
      media_type: 'CAROUSEL',
      children: children.join(','),
      caption
    },
    fetchImpl
  });

  if (!payload.id) {
    throw new Error('Instagram carousel container response did not include an id');
  }

  return payload.id;
}

async function publishContainer({ config, creationId, fetchImpl }) {
  const payload = await graphPost({
    config,
    path: `${config.instagramBusinessAccountId}/media_publish`,
    params: {
      creation_id: creationId
    },
    fetchImpl
  });

  if (!payload.id) {
    throw new Error('Instagram publish response did not include an id');
  }

  return payload.id;
}

async function getPermalink({ config, mediaId, fetchImpl }) {
  try {
    const payload = await graphGet({
      config,
      path: mediaId,
      params: {
        fields: 'permalink'
      },
      fetchImpl
    });

    return payload.permalink || '';
  } catch {
    return '';
  }
}

export async function publishInstagramCardNews({ config, imageUrls, caption, fetchImpl = fetch }) {
  assertConfig(config);

  if (imageUrls.length === 1) {
    const creationId = await createImageContainer({
      config,
      imageUrl: imageUrls[0],
      carouselItem: false,
      caption,
      fetchImpl
    });
    const mediaId = await publishContainer({ config, creationId, fetchImpl });
    const permalink = await getPermalink({ config, mediaId, fetchImpl });

    return {
      mediaId,
      containerId: creationId,
      childContainerIds: [],
      publishedUrl: permalink
    };
  }

  if (imageUrls.length < MIN_CAROUSEL_IMAGES || imageUrls.length > MAX_CAROUSEL_IMAGES) {
    throw new Error('Instagram carousel publishing requires 2-10 public image URLs');
  }

  const childContainerIds = [];
  for (const imageUrl of imageUrls) {
    childContainerIds.push(await createImageContainer({
      config,
      imageUrl,
      carouselItem: true,
      fetchImpl
    }));
  }

  const containerId = await createCarouselContainer({
    config,
    children: childContainerIds,
    caption,
    fetchImpl
  });
  const mediaId = await publishContainer({ config, creationId: containerId, fetchImpl });
  const permalink = await getPermalink({ config, mediaId, fetchImpl });

  return {
    mediaId,
    containerId,
    childContainerIds,
    publishedUrl: permalink
  };
}

export function createMockInstagramPublishResult(row) {
  const mediaId = `mock_instagram_${row.channel_output_id || row.id}`;
  return {
    mediaId,
    containerId: `mock_container_${row.channel_output_id || row.id}`,
    childContainerIds: [],
    publishedUrl: `mock://instagram/${mediaId}`
  };
}
