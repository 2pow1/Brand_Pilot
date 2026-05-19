import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPipelineProgress } from '../src/progress.js';

test('shows the next action for draft_created content', () => {
  const progress = buildPipelineProgress({
    contentByStatus: [
      { status: 'draft_created', count: 2 },
      { status: 'pending_review', count: 1 }
    ]
  });

  assert.equal(progress.currentStep, '병렬 진행 중: 초안 생성 완료, 검수 요청 대기, Discord 검수 대기');
  assert.match(progress.nextCommands[0], /review request/);
  assert.equal(progress.stages.find((stage) => stage.status === 'draft_created').count, 2);
});

test('suggests upload when publish_pending artifacts are still local', () => {
  const progress = buildPipelineProgress({
    contentByStatus: [{ status: 'publish_pending', count: 1 }],
    publishPendingArtifacts: {
      uploadPendingCount: 1,
      publishReadyCount: 0
    }
  });

  assert.equal(progress.currentStep, '이미지 업로드 대기');
  assert.deepEqual(progress.nextCommands, ['node --no-warnings=ExperimentalWarning src/cli.js instagram upload --limit 1']);
});

test('suggests publish when publish_pending artifacts are already public', () => {
  const progress = buildPipelineProgress({
    contentByStatus: [{ status: 'publish_pending', count: 1 }],
    publishPendingArtifacts: {
      uploadPendingCount: 0,
      publishReadyCount: 1
    }
  });

  assert.equal(progress.currentStep, 'Instagram 게시 대기');
  assert.deepEqual(progress.nextCommands, ['node --no-warnings=ExperimentalWarning src/cli.js instagram publish --limit 1']);
});
