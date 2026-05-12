import { CONTENT_STATUSES } from './state.js';

const PIPELINE_STAGES = [
  {
    id: 'collect',
    label: '수집 완료, 초안 대기',
    status: CONTENT_STATUSES.COLLECTED,
    nextCommand: 'node --no-warnings=ExperimentalWarning src/cli.js draft --mock --limit 1'
  },
  {
    id: 'draft',
    label: '초안 생성 완료, 검수 요청 대기',
    status: CONTENT_STATUSES.DRAFT_CREATED,
    nextCommand: 'node --no-warnings=ExperimentalWarning src/cli.js review request --mock --limit 1'
  },
  {
    id: 'review',
    label: 'Discord 검수 대기',
    status: CONTENT_STATUSES.PENDING_REVIEW,
    nextCommand: 'node --no-warnings=ExperimentalWarning src/cli.js review approve <content-id>'
  },
  {
    id: 'approved',
    label: '승인 완료, 채널 생성 대기',
    status: CONTENT_STATUSES.APPROVED,
    nextCommand: 'node --no-warnings=ExperimentalWarning src/cli.js channel generate --limit 1'
  },
  {
    id: 'channel',
    label: '채널별 콘텐츠 생성 완료',
    status: CONTENT_STATUSES.CHANNEL_GENERATED,
    nextCommand: 'node --no-warnings=ExperimentalWarning src/cli.js instagram publish --limit 1'
  },
  {
    id: 'publish',
    label: '게시 대기',
    status: CONTENT_STATUSES.PUBLISH_PENDING,
    nextCommand: 'node --no-warnings=ExperimentalWarning src/cli.js instagram publish --limit 1'
  },
  {
    id: 'done',
    label: '게시 완료',
    status: CONTENT_STATUSES.PUBLISHED,
    nextCommand: ''
  }
];

function countByStatus(summary) {
  return Object.fromEntries(summary.contentByStatus.map((row) => [row.status, row.count]));
}

export function buildPipelineProgress(summary) {
  const counts = countByStatus(summary);
  const stages = PIPELINE_STAGES.map((stage) => ({
    id: stage.id,
    label: stage.label,
    status: stage.status,
    count: counts[stage.status] || 0,
    nextCommand: stage.nextCommand
  }));
  const failedCount = counts[CONTENT_STATUSES.FAILED] || 0;
  const activeSteps = stages.filter((stage) => stage.count > 0);
  const currentStep =
    activeSteps.length > 1
      ? `병렬 진행 중: ${activeSteps.map((stage) => stage.label).join(', ')}`
      : activeSteps[0]?.label || '대기 중';
  const nextCommands = activeSteps
    .map((stage) => stage.nextCommand)
    .filter(Boolean);

  return {
    currentStep,
    activeSteps,
    nextCommands: nextCommands.length
      ? nextCommands
      : ['node --no-warnings=ExperimentalWarning src/cli.js collect --limit 1'],
    failedCount,
    stages
  };
}
