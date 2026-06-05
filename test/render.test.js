import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildInstagramRenderPaths } from '../src/render/instagram.js';
import {
  buildInstagramSketchCardHtml,
  escapeHtml,
  prepareCoverImage,
  toCssImageUrl
} from '../src/render/instagram-sketch.js';

test('builds deterministic Instagram render paths', () => {
  const paths = buildInstagramRenderPaths({
    cwd: 'D:/workspace/Brand_Pilot',
    contentItemId: 'content_123'
  });

  assert.match(paths.outputDir.replaceAll('\\', '/'), /artifacts\/generated\/instagram\/content_123$/);
  assert.match(paths.inputJsonPath.replaceAll('\\', '/'), /tmp\/render\/content_123-instagram\.json$/);
  assert.match(paths.scriptPath.replaceAll('\\', '/'), /scripts\/render-instagram-card-news\.ps1$/);
});

test('escapes model text before rendering sketch template HTML', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});

test('builds sketch template HTML from a v2 cover card', () => {
  const html = buildInstagramSketchCardHtml({
    cwd: 'D:/workspace/Brand_Pilot',
    payload: {
      brandName: 'GrowthLine',
      template: 'instagram-sketch-card-news-v2',
      dimensions: {
        width: 1080,
        height: 1350
      },
      design: {
        background: '#f7f1e3',
        foreground: '#151515',
        muted: '#706b61',
        accent: '#c9f24d',
        border: '#1c1c1c'
      },
      contentTitle: 'Card title',
      coverImagePrompt: 'No text background'
    },
    card: {
      index: 1,
      page: '1/2',
      layout: '01',
      layout_name: 'Cover',
      kicker: 'Brand Note',
      title: 'Customers read\nsignals first',
      subtitle: 'A short subtitle'
    },
    total: 2
  });

  assert.match(html, /layout-01/);
  assert.match(html, /Customers read<br>signals first/);
  assert.match(html, /GrowthLine/);
  assert.doesNotMatch(html, /<script>/);
});

test('converts local cover image paths to file URLs for sketch rendering', () => {
  const cssUrl = toCssImageUrl({
    cwd: 'D:/workspace/Brand_Pilot',
    value: 'artifacts/generated/cover.png'
  });

  assert.match(cssUrl, /^url\("file:\/\/\//);
  assert.match(cssUrl.replaceAll('\\', '/'), /artifacts\/generated\/cover\.png/);
});

test('generates a cover image when sketch cover images are enabled', async () => {
  const outputDir = 'D:/workspace/Brand_Pilot/tmp/render-test';
  const fetchImpl = async () =>
    Response.json({
      data: [{ b64_json: Buffer.from('image').toString('base64') }]
    });
  const payload = await prepareCoverImage({
    config: {
      cwd: 'D:/workspace/Brand_Pilot',
      instagramCoverImageEnabled: true,
      openaiApiKey: 'test-key',
      openaiBaseUrl: 'https://api.openai.com/v1',
      openaiImageModel: 'gpt-image-1',
      openaiImageSize: '1024x1536',
      openaiImageQuality: 'medium'
    },
    outputDir,
    payload: {
      coverImagePrompt: 'Warm paper background'
    },
    fetchImpl
  });

  assert.match(payload.coverImagePath.replaceAll('\\', '/'), /tmp\/render-test\/cover-background\.png$/);
  assert.equal(payload.coverImage.status, 'generated');
  assert.equal(payload.coverImage.model, 'gpt-image-1');
});
