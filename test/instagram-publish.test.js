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
    fetchImpl
  });

  assert.equal(result.mediaId, 'media_123');
  assert.equal(result.publishedUrl, 'https://www.instagram.com/p/shortcode/');
  assert.equal(calls.length, 6);
  assert.equal(calls[0].url, 'https://graph.facebook.com/v25.0/17890000000000000/media');
  assert.equal(calls[0].body.image_url, 'https://storage.example.com/slide-01.png');
  assert.equal(calls[0].body.is_carousel_item, 'true');
  assert.equal(calls[3].body.media_type, 'CAROUSEL');
  assert.equal(calls[3].body.children, 'container_1,container_2,container_3');
  assert.equal(calls[3].body.caption, 'Caption');
  assert.equal(calls[4].body.creation_id, 'container_4');
  assert.equal(calls[5].url, 'https://graph.facebook.com/v25.0/media_123?fields=permalink&access_token=meta-token');
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
