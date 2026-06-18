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

test('infers compact rendering for long sketch card titles', () => {
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
      contentTitle: 'Card title'
    },
    card: {
      index: 4,
      page: '4/7',
      layout: '06',
      layout_name: 'Before / After',
      title: '어째서 가격 표현이 고객의 신뢰를 잃히는 이유를 계속 만듭니다',
      before: '서비스를 소개합니다.\n성공 사례를 공개합니다.\n신규 프로그램을 출시했습니다.',
      after: '고객이 신뢰를 느끼는 지점을 먼저 보여줍니다.\n비교 기준을 더 선명하게 만듭니다.'
    },
    total: 7
  });

  assert.match(html, /layout-06/);
  assert.match(html, /class="slide layout-06 title-fit-compressed content-fit-(?:normal|tight|compressed) chrome-header-normal chrome-footer-normal"/);
  assert.match(html, /\.title-fit-compressed h2/);
  assert.match(html, /font-size: 50px/);
});

test('compresses dense sketch body layouts and strips repeated section labels', () => {
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
      contentTitle: 'Card title'
    },
    card: {
      index: 3,
      page: '3/7',
      layout: '06',
      layout_name: 'Before / After',
      title: '같은 내용도\n읽히는 방식이 다릅니다',
      before: 'Before\n\n“우리 서비스를 소개합니다”\n“성공 사례를 공개합니다”\n\n브랜드가 하고 싶은 말에서\n출발합니다.',
      after:
        'After\n\n“소규모 B2B 브랜드가\n제안서에서 자주 놓치는 3가지”\n\n“고객이 가격을 걱정하다가\n신뢰를 느낀 지점”\n\n고객의 고민에서\n출발합니다.'
    },
    total: 7
  });

  assert.match(html, /class="slide layout-06 title-fit-normal content-fit-compressed chrome-header-normal chrome-footer-normal"/);
  assert.match(html, /\.layout-06\.content-fit-compressed \.before-after section > p:not\(\.label\)/);
  assert.match(html, /\.layout-06\.content-fit-compressed \.content {\n    padding-top: 64px;/);
  assert.match(html, /\.content-fit-compressed h2 {\n    margin-bottom: 52px;/);
  assert.match(html, /font-size: 28px/);
  assert.doesNotMatch(html, /<p>Before<br>/);
  assert.doesNotMatch(html, /<p>After<br>/);
});

test('keeps short line-heavy before-after cards in tight rendering', () => {
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
      contentTitle: 'Card title'
    },
    card: {
      index: 4,
      page: '4/8',
      layout: '06',
      layout_name: 'Before / After',
      title: '회사 게시판에서 벗어나기',
      before: '출시 소식\n행사 참여\n제휴 발표\n우리 이야기만\n계속 쌓입니다.',
      after: '고객의 걱정\n결정 기준\n해결 과정\n상대가 궁금한 쪽으로\n방향을 바꿉니다.'
    },
    total: 8
  });

  assert.match(html, /class="slide layout-06 title-fit-normal content-fit-tight chrome-header-normal chrome-footer-normal"/);
  assert.match(html, /\.layout-06\.content-fit-tight \.before-after section > p:not\(\.label\)/);
  assert.match(html, /font-size: 31px/);
  assert.doesNotMatch(html, /content-fit-compressed"/);
});

test('joins short manual body line breaks before rendering', () => {
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
      contentTitle: 'Card title'
    },
    card: {
      index: 5,
      page: '5/8',
      layout: '05',
      layout_name: 'Checklist',
      title: '먼저 볼 4가지',
      items: [
        '프로필과 페이지가\n같은 말을 하는가',
        '한 문장으로\n대상이 보이는가',
        '고객 상황에서\n글이 시작되는가',
        '성과보다 과정과\n기준을 보여주는가'
      ]
    },
    total: 8
  });

  assert.match(html, /프로필과 페이지가 같은 말을 하는가/);
  assert.match(html, /성과보다 과정과 기준을 보여주는가/);
  assert.doesNotMatch(html, /프로필과 페이지가<br>같은 말을 하는가/);
});

test('applies compact and hidden sketch chrome options while rendering', () => {
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
      chrome: {
        header: 'compact',
        footer: 'hidden'
      },
      contentTitle: 'Hidden footer title'
    },
    card: {
      index: 5,
      page: '5/8',
      layout: '05',
      layout_name: 'Checklist',
      title: 'Use more space',
      items: ['Audience is clear', 'Problem is specific', 'Process is visible', 'Next action is natural']
    },
    total: 8
  });

  assert.match(html, /chrome-header-compact/);
  assert.match(html, /chrome-footer-hidden/);
  assert.match(html, /<header class="brand">/);
  assert.doesNotMatch(html, /<footer class="footer">/);
  assert.doesNotMatch(html, /Hidden footer title/);
  assert.match(html, /\.slide\.chrome-header-compact {\n    --header-space: 46px;/);
  assert.match(html, /\.slide\.chrome-footer-hidden {\n    --footer-space: 0px;/);
  assert.match(html, /height: calc\(100% - var\(--header-space\) - var\(--footer-space\)\);/);
});

test('compresses dense problem-solution sketch cards', () => {
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
      contentTitle: 'Card title'
    },
    card: {
      index: 2,
      page: '2/7',
      layout: '03',
      layout_name: 'Problem / Solution',
      title: '반응이 없는 이유는\n게시물 개수만의 문제가 아닙니다',
      problem_title: '문제',
      problem:
        '서비스 출시와 행사 참여 소식만 계속 쌓입니다.\n제휴 발표와 채용 공고가 같은 형식으로 반복됩니다.\n회사 이야기는 많은데 고객 질문에는 답이 없습니다.\n믿을 단서와 판단 기준이 보이지 않습니다.',
      solution_title: '방향',
      solution:
        '이 브랜드가 어떤 문제를 반복해서 해결했는지 보여줘야 합니다.\n대표와 팀이 어떤 관점으로 일하는지 짧게 설명해야 합니다.\n비슷한 고객에게 어떤 도움을 줬는지 사례로 남겨야 합니다.\n고객의 고민에서 시작해 신뢰의 근거를 쌓아야 합니다.'
    },
    total: 7
  });

  assert.match(html, /class="slide layout-03 title-fit-normal content-fit-compressed chrome-header-normal chrome-footer-normal"/);
  assert.match(html, /\.layout-03\.content-fit-compressed \.split-block p:not\(\.label\)/);
  assert.match(html, /\.layout-03\.content-fit-compressed \.content {\n    height: calc\(100% - var\(--header-space\) - var\(--footer-space\) - 98px\);\n    padding-top: 62px;/);
  assert.match(html, /\.layout-03\.content-fit-compressed h2 {\n    margin-bottom: 50px;/);
  assert.match(html, /font-size: 26px/);
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
  assert.match(html, /\.slide\.has-cover-image \.content {\n    align-items: flex-end;\n    height: calc\(100% - var\(--header-space\) - var\(--footer-space\) - 124px\);/);
  assert.match(html, /\.slide\.has-cover-image \.cover-copy {\n    position: relative;\n    margin-top: 0;/);
  assert.match(html, /\.footer span:first-child {\n    max-width: calc\(100% - 96px\);/);
  assert.match(html, /\.slide\.has-cover-image \.footer span {\n    padding: 5px 8px 6px;\n    background: rgba\(251, 246, 232, 0\.78\);/);
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
