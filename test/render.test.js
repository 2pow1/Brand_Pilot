import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildInstagramRenderPaths } from '../src/render/instagram.js';
import {
  applyStaticFinalCtaCard,
  buildInstagramSketchCardHtml,
  escapeHtml,
  prepareCoverImage,
  resolveCoverImage,
  toCssImageUrl
} from '../src/render/instagram-sketch.js';
import { createInstagramSketchPreviewPayload } from '../src/render/instagram-preview.js';

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

test('builds a deterministic sketch preview payload', () => {
  const payload = createInstagramSketchPreviewPayload({
    brand: {
      companyName: 'GrowthLine'
    }
  });

  assert.equal(payload.template, 'instagram-sketch-card-news-v2');
  assert.equal(payload.dimensions.width, 1080);
  assert.equal(payload.dimensions.height, 1350);
  assert.equal(payload.cards.length, 8);
  assert.equal(payload.cards[0].layout, '01');
  assert.equal(payload.cards.at(-1).layout, '09');
  assert.equal(payload.coverImagePrompt.includes('no readable text'), true);
});

test('renders the final sketch card as a static CTA image when configured', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'brand-pilot-render-'));
  const imagePath = join(cwd, 'cta.png');
  writeFileSync(imagePath, Buffer.from('png'));
  const payload = applyStaticFinalCtaCard({
    cwd,
    payload: createInstagramSketchPreviewPayload({
      brand: {
        companyName: 'GrowthLine'
      }
    }),
    config: {
      instagramFinalCtaImagePath: imagePath
    }
  });
  const lastCard = payload.cards.at(-1);
  const html = buildInstagramSketchCardHtml({
    cwd,
    payload,
    card: lastCard,
    total: payload.cards.length
  });

  assert.equal(lastCard.staticImagePath, imagePath);
  assert.equal(payload.cards.length, 8);
  assert.equal(payload.cards[0].page, '1/8');
  assert.equal(lastCard.page, '8/8');
  assert.match(html, /static-image-slide/);
  assert.match(html, /background-size: cover/);
  assert.doesNotMatch(html, /Save this before/);
});

test('converts local cover image paths to file URLs for sketch rendering', () => {
  const cssUrl = toCssImageUrl({
    cwd: 'D:/workspace/Brand_Pilot',
    value: 'artifacts/generated/cover.png'
  });

  assert.match(cssUrl, /^url\("file:\/\/\//);
  assert.match(cssUrl.replaceAll('\\', '/'), /artifacts\/generated\/cover\.png/);
});

test('embeds generated local cover images as data URLs for sketch rendering', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'brand-pilot-cover-'));
  const imagePath = join(cwd, 'cover.png');
  writeFileSync(imagePath, Buffer.from('png'));
  const cssUrl = resolveCoverImage({
    cwd,
    payload: {
      coverImagePath: imagePath
    }
  });

  assert.match(cssUrl, /^url\("data:image\/png;base64,/);
  assert.doesNotMatch(cssUrl, /file:\/\//);
});

test('writes cover image data directly into the sketch cover background rule', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'brand-pilot-cover-html-'));
  const imagePath = join(cwd, 'cover.png');
  writeFileSync(imagePath, Buffer.from('png'));
  const html = buildInstagramSketchCardHtml({
    cwd,
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
      coverImagePath: imagePath
    },
    card: {
      index: 1,
      page: '1/2',
      layout: '01',
      layout_name: 'Cover',
      kicker: 'Brand Note',
      title: 'Customers read signals first',
      subtitle: 'A short subtitle'
    },
    total: 2
  });

  assert.match(html, /background-image: url\("data:image\/png;base64,/);
  assert.doesNotMatch(html, /background-image: var\(--cover-image\)/);
  assert.doesNotMatch(html, /--cover-image/);
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
