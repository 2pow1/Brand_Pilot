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
