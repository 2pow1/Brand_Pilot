import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildInstagramRenderPaths } from '../src/render/instagram.js';
import { buildInstagramSketchCardHtml, escapeHtml, toCssImageUrl } from '../src/render/instagram-sketch.js';

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
