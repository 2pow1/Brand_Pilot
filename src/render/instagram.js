import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Computes the renderer input, script, and output paths for a content item.
 */
export function buildInstagramRenderPaths({ cwd, contentItemId }) {
  const outputDir = resolve(cwd, 'artifacts/generated/instagram', contentItemId);
  const inputJsonPath = resolve(cwd, 'tmp/render', `${contentItemId}-instagram.json`);
  const scriptPath = resolve(cwd, 'scripts/render-instagram-card-news.ps1');

  return {
    outputDir,
    inputJsonPath,
    scriptPath
  };
}

/**
 * Runs the PowerShell card-news renderer and returns generated slide metadata.
 */
export function renderInstagramCardNews({ cwd, contentItemId, payload }) {
  const paths = buildInstagramRenderPaths({ cwd, contentItemId });
  mkdirSync(paths.outputDir, { recursive: true });
  mkdirSync(resolve(cwd, 'tmp/render'), { recursive: true });
  writeFileSync(paths.inputJsonPath, JSON.stringify(payload, null, 2), 'utf8');

  const result = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      paths.scriptPath,
      '-InputJsonPath',
      paths.inputJsonPath,
      '-OutputDir',
      paths.outputDir
    ],
    {
      cwd,
      encoding: 'utf8'
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Renderer exited with status ${result.status}`);
  }

  const output = result.stdout.trim();
  if (!output) {
    throw new Error('Renderer did not return output JSON');
  }

  return JSON.parse(output);
}
