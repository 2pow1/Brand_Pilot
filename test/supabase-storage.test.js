import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import {
  cleanupInstagramRenderArtifact,
  objectPathFromPublicUrl,
  uploadInstagramRenderArtifact
} from '../src/storage/supabase.js';

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseServiceRoleKey: 'service-role-key',
  supabaseStorageBucket: 'brand-pilot-instagram'
};

function createRenderedArtifact({ manifestPrefix = '' } = {}) {
  mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
  const dir = mkdtempSync(resolve(process.cwd(), 'tmp/storage-upload-'));
  const slideOne = join(dir, 'slide-01.png');
  const slideTwo = join(dir, 'slide-02.png');
  writeFileSync(slideOne, Buffer.from('png-one'));
  writeFileSync(slideTwo, Buffer.from('png-two'));
  writeFileSync(
    join(dir, 'manifest.json'),
    `${manifestPrefix}${JSON.stringify({
      caption: 'Caption',
      hashtags: ['#brand'],
      slides: [slideOne, slideTwo],
      source: {
        title: 'Source title',
        url: 'https://example.com'
      }
    })}`
  );

  return dir;
}

test('uploads rendered Instagram slides and a public manifest to Supabase Storage', async () => {
  const artifactPath = createRenderedArtifact();
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({
      url,
      method: options.method,
      headers: options.headers,
      body: options.body
    });

    return Response.json({
      Key: String(url).split('/storage/v1/object/')[1]
    });
  };
  const result = await uploadInstagramRenderArtifact({
    config,
    row: {
      id: 'content_123',
      channel_output_id: 'channel_456',
      channel_artifact_path: artifactPath
    },
    payload: {},
    fetchImpl
  });

  assert.equal(result.uploaded, true);
  assert.equal(result.slides.length, 2);
  assert.equal(result.manifestObjectPath, 'instagram/content_123/channel_456/manifest.json');
  assert.equal(
    result.manifestPublicUrl,
    'https://project.supabase.co/storage/v1/object/public/brand-pilot-instagram/instagram/content_123/channel_456/manifest.json'
  );
  assert.equal(calls.length, 3);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers.Authorization, 'Bearer service-role-key');
  assert.equal(calls[0].headers['x-upsert'], 'true');
  assert.equal(calls[0].headers['Content-Type'], 'image/png');
  assert.equal(calls[2].headers['Content-Type'], 'application/json');

  const uploadedManifest = JSON.parse(Buffer.from(calls[2].body).toString('utf8'));
  assert.equal(uploadedManifest.slides[0].publicUrl, result.slides[0].publicUrl);
});

test('uploads a rendered manifest with a UTF-8 BOM', async () => {
  const artifactPath = createRenderedArtifact({ manifestPrefix: '\uFEFF' });
  const calls = [];
  const result = await uploadInstagramRenderArtifact({
    config,
    row: {
      id: 'content_bom',
      channel_output_id: 'channel_bom',
      channel_artifact_path: artifactPath
    },
    payload: {},
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return Response.json({});
    }
  });

  assert.equal(result.uploaded, true);
  assert.equal(result.slides.length, 2);
  assert.equal(calls.length, 3);
});

test('skips upload when the artifact path is already public', async () => {
  const result = await uploadInstagramRenderArtifact({
    config,
    row: {
      id: 'content_123',
      channel_artifact_path: 'https://project.supabase.co/storage/v1/object/public/brand-pilot-instagram/manifest.json'
    },
    payload: {},
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    }
  });

  assert.equal(result.uploaded, false);
  assert.equal(result.manifestPublicUrl, 'https://project.supabase.co/storage/v1/object/public/brand-pilot-instagram/manifest.json');
});

test('extracts object paths from Supabase public object URLs', () => {
  const objectPath = objectPathFromPublicUrl({
    config,
    bucket: 'brand-pilot-instagram',
    publicUrl:
      'https://project.supabase.co/storage/v1/object/public/brand-pilot-instagram/instagram/content_123/channel_456/slide%2001.png'
  });

  assert.equal(objectPath, 'instagram/content_123/channel_456/slide 01.png');
});

test('dry-runs backed-up Instagram artifact cleanup', async () => {
  const manifestUrl =
    'https://project.supabase.co/storage/v1/object/public/brand-pilot-instagram/instagram/content_123/channel_456/manifest.json';
  const result = await cleanupInstagramRenderArtifact({
    config,
    row: {
      id: 'content_123',
      channel_output_id: 'channel_456',
      channel_artifact_path: manifestUrl
    },
    dryRun: true,
    fetchImpl: async (url) => {
      assert.equal(String(url), manifestUrl);
      return Response.json({
        storage: {
          bucket: 'brand-pilot-instagram',
          manifestObjectPath: 'instagram/content_123/channel_456/manifest.json'
        },
        slides: [
          {
            objectPath: 'instagram/content_123/channel_456/slide-01.png',
            publicUrl:
              'https://project.supabase.co/storage/v1/object/public/brand-pilot-instagram/instagram/content_123/channel_456/slide-01.png'
          },
          {
            publicUrl:
              'https://project.supabase.co/storage/v1/object/public/brand-pilot-instagram/instagram/content_123/channel_456/slide-02.png'
          }
        ]
      });
    }
  });

  assert.equal(result.dryRun, true);
  assert.deepEqual(result.objectPaths, [
    'instagram/content_123/channel_456/manifest.json',
    'instagram/content_123/channel_456/slide-01.png',
    'instagram/content_123/channel_456/slide-02.png'
  ]);
});

test('deletes backed-up Instagram artifact objects from Supabase Storage', async () => {
  const manifestUrl =
    'https://project.supabase.co/storage/v1/object/public/brand-pilot-instagram/instagram/content_123/channel_456/manifest.json';
  const calls = [];
  const result = await cleanupInstagramRenderArtifact({
    config,
    row: {
      id: 'content_123',
      channel_output_id: 'channel_456',
      channel_artifact_path: manifestUrl
    },
    dryRun: false,
    fetchImpl: async (url, options = {}) => {
      calls.push({
        url: String(url),
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body ? JSON.parse(options.body) : null
      });

      if (!options.method) {
        return Response.json({
          storage: {
            bucket: 'brand-pilot-instagram',
            manifestObjectPath: 'instagram/content_123/channel_456/manifest.json'
          },
          slides: [
            {
              objectPath: 'instagram/content_123/channel_456/slide-01.png'
            }
          ]
        });
      }

      return Response.json([{ name: 'slide-01.png' }]);
    }
  });

  assert.equal(result.dryRun, false);
  assert.equal(result.deletedCount, 2);
  assert.equal(calls[1].method, 'DELETE');
  assert.equal(calls[1].headers.Authorization, 'Bearer service-role-key');
  assert.deepEqual(calls[1].body.prefixes, [
    'instagram/content_123/channel_456/manifest.json',
    'instagram/content_123/channel_456/slide-01.png'
  ]);
});

test('refuses to clean objects outside the expected content prefix', async () => {
  const manifestUrl =
    'https://project.supabase.co/storage/v1/object/public/brand-pilot-instagram/instagram/content_123/channel_456/manifest.json';

  await assert.rejects(
    cleanupInstagramRenderArtifact({
      config,
      row: {
        id: 'content_123',
        channel_output_id: 'channel_456',
        channel_artifact_path: manifestUrl
      },
      fetchImpl: async () =>
        Response.json({
          storage: {
            manifestObjectPath: 'instagram/other/channel_456/manifest.json'
          },
          slides: []
        })
    }),
    /outside expected prefix/
  );
});
