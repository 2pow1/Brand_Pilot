import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { uploadInstagramRenderArtifact } from '../src/storage/supabase.js';

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
