import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadInstagramPublishInput, publishInstagramCardNews } from '../src/publish/instagram.js';

const config = {
  metaAccessToken: 'meta-token',
  metaGraphBaseUrl: 'https://graph.facebook.com/v25.0',
  instagramBusinessAccountId: '17890000000000000'
};

function decodeBody(body) {
  return Object.fromEntries(body.entries());
}

test('publishes carousel images through the Instagram Graph API', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    if (!options) {
      calls.push({
        url: String(url),
        method: 'GET',
        body: null
      });
      if (String(url).includes('fields=status')) {
        return Response.json({ status_code: 'FINISHED', status: 'Finished' });
      }

      return Response.json({ permalink: 'https://www.instagram.com/p/shortcode/' });
    }

    const body = decodeBody(options.body);
    calls.push({
      url,
      method: options.method,
      body
    });

    if (url.endsWith('/media_publish')) {
      return Response.json({ id: 'media_123' });
    }

    return Response.json({ id: `container_${calls.length}` });
  };
  const result = await publishInstagramCardNews({
    config,
    imageUrls: [
      'https://storage.example.com/slide-01.png',
      'https://storage.example.com/slide-02.png',
      'https://storage.example.com/slide-03.png'
    ],
    caption: 'Caption',
    fetchImpl,
    containerPollIntervalMs: 0
  });

  assert.equal(result.mediaId, 'media_123');
  assert.equal(result.publishedUrl, 'https://www.instagram.com/p/shortcode/');
  assert.equal(calls.length, 7);
  assert.equal(calls[0].url, 'https://graph.facebook.com/v25.0/17890000000000000/media');
  assert.equal(calls[0].body.image_url, 'https://storage.example.com/slide-01.png');
  assert.equal(calls[0].body.is_carousel_item, 'true');
  assert.equal(calls[3].body.media_type, 'CAROUSEL');
  assert.equal(calls[3].body.children, 'container_1,container_2,container_3');
  assert.equal(calls[3].body.caption, 'Caption');
  assert.equal(calls[4].method, 'GET');
  assert.equal(String(calls[4].url), 'https://graph.facebook.com/v25.0/container_4?fields=status%2Cstatus_code&access_token=meta-token');
  assert.equal(calls[5].body.creation_id, 'container_4');
  assert.equal(calls[6].url, 'https://graph.facebook.com/v25.0/media_123?fields=permalink&access_token=meta-token');
});

test('waits for carousel container processing before publish', async () => {
  let statusPollCount = 0;
  const calls = [];
  const fetchImpl = async (url, options) => {
    if (!options) {
      calls.push({ url: String(url), method: 'GET' });
      if (String(url).includes('fields=status')) {
        statusPollCount += 1;
        return Response.json({
          status_code: statusPollCount === 1 ? 'IN_PROGRESS' : 'FINISHED',
          status: statusPollCount === 1 ? 'In progress' : 'Finished'
        });
      }

      return Response.json({ permalink: 'https://www.instagram.com/p/shortcode/' });
    }

    const body = decodeBody(options.body);
    calls.push({ url, method: options.method, body });

    if (url.endsWith('/media_publish')) {
      return Response.json({ id: 'media_456' });
    }

    return Response.json({ id: `container_${calls.length}` });
  };

  const result = await publishInstagramCardNews({
    config,
    imageUrls: [
      'https://storage.example.com/slide-01.png',
      'https://storage.example.com/slide-02.png'
    ],
    caption: 'Caption',
    fetchImpl,
    containerPollIntervalMs: 0
  });

  assert.equal(result.mediaId, 'media_456');
  assert.equal(statusPollCount, 2);
  assert.equal(calls.at(-2).body.creation_id, 'container_3');
});

test('loads public image URLs from a remote manifest', async () => {
  const fetchImpl = async () =>
    Response.json({
      caption: 'Manifest caption',
      hashtags: ['#brand'],
      slides: [
        { publicUrl: 'https://storage.example.com/slide-01.png' },
        { publicUrl: 'https://storage.example.com/slide-02.png' }
      ]
    });
  const input = await loadInstagramPublishInput({
    row: {
      channel_artifact_path: 'https://storage.example.com/instagram/content_123/manifest.json'
    },
    payload: {
      caption: 'Payload caption',
      hashtags: ['#pilot']
    },
    fetchImpl
  });

  assert.deepEqual(input.imageUrls, [
    'https://storage.example.com/slide-01.png',
    'https://storage.example.com/slide-02.png'
  ]);
  assert.equal(input.caption, 'Manifest caption\n\n#brand #pilot');
});

test('rejects local-only rendered images for real publishing', async () => {
  await assert.rejects(
    () =>
      loadInstagramPublishInput({
        row: {
          channel_artifact_path: ''
        },
        payload: {
          slides: [{ headline: 'No public image here' }]
        }
      }),
    /requires public image URLs/
  );
});
