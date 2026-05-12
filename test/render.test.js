import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildInstagramRenderPaths } from '../src/render/instagram.js';

test('builds deterministic Instagram render paths', () => {
  const paths = buildInstagramRenderPaths({
    cwd: 'D:/workspace/Brand_Pilot',
    contentItemId: 'content_123'
  });

  assert.match(paths.outputDir.replaceAll('\\', '/'), /artifacts\/generated\/instagram\/content_123$/);
  assert.match(paths.inputJsonPath.replaceAll('\\', '/'), /tmp\/render\/content_123-instagram\.json$/);
  assert.match(paths.scriptPath.replaceAll('\\', '/'), /scripts\/render-instagram-card-news\.ps1$/);
});
