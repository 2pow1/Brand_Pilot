import { CONTENT_STATUSES } from './state.js';

const COMMANDS = Object.freeze({
  collect: 'node --no-warnings=ExperimentalWarning src/cli.js collect --limit 1',
  draft: 'node --no-warnings=ExperimentalWarning src/cli.js draft --mock --limit 1',
  reviewRequest: 'node --no-warnings=ExperimentalWarning src/cli.js review request --mock --limit 1',
  reviewApprove: 'node --no-warnings=ExperimentalWarning src/cli.js review approve <content-id>',
  channelGenerate: 'node --no-warnings=ExperimentalWarning src/cli.js channel generate --limit 1',
  instagramRender: 'node --no-warnings=ExperimentalWarning src/cli.js instagram render --limit 1',
  instagramUpload: 'node --no-warnings=ExperimentalWarning src/cli.js instagram upload --limit 1',
  instagramPublish: 'node --no-warnings=ExperimentalWarning src/cli.js instagram publish --limit 1'
});

const PIPELINE_STAGES = [
  {
    id: 'collect',
    label: '수집 완료, 초안 대기',
    status: CONTENT_STATUSES.COLLECTED,
    nextCommand: COMMANDS.draft
  },
  {
    id: 'draft',
    label: '초안 생성 완료, 검수 요청 대기',
    status: CONTENT_STATUSES.DRAFT_CREATED,
    nextCommand: COMMANDS.reviewRequest
  },
  {
    id: 'review',
    label: 'Discord 검수 대기',
    status: CONTENT_STATUSES.PENDING_REVIEW,
    nextCommand: COMMANDS.reviewApprove
  },
  {
    id: 'approved',
    label: '승인 완료, 채널 생성 대기',
    status: CONTENT_STATUSES.APPROVED,
    nextCommand: COMMANDS.channelGenerate
  },
  {
    id: 'channel',
    label: '카드뉴스 이미지 렌더링 대기',
    status: CONTENT_STATUSES.CHANNEL_GENERATED,
    nextCommand: COMMANDS.instagramRender
  }
];

const DONE_STAGE = {
  id: 'done',
  label: '게시 완료',
  status: CONTENT_STATUSES.PUBLISHED,
  nextCommand: ''
};

/**
 * Converts grouped status rows into a lookup map for progress rendering.
 */
function countByStatus(summary) {
  return Object.fromEntries(summary.contentByStatus.map((row) => [row.status, row.count]));
}

/**
 * Returns upload and publish pseudo-stages without changing the stored status model.
 */
function buildPublishStages(summary, publishPendingCount) {
  const artifactStats = summary.publishPendingArtifacts;

  if (!artifactStats) {
    return [
      {
        id: 'publish',
        label: '게시 대기',
        status: CONTENT_STATUSES.PUBLISH_PENDING,
        count: publishPendingCount,
        nextCommand: COMMANDS.instagramUpload
      }
    ];
  }

  return [
    {
      id: 'upload',
      label: '이미지 업로드 대기',
      status: CONTENT_STATUSES.PUBLISH_PENDING,
      count: artifactStats.uploadPendingCount || 0,
      nextCommand: COMMANDS.instagramUpload
    },
    {
      id: 'publish',
      label: 'Instagram 게시 대기',
      status: CONTENT_STATUSES.PUBLISH_PENDING,
      count: artifactStats.publishReadyCount || 0,
      nextCommand: COMMANDS.instagramPublish
    }
  ];
}

/**
 * Builds the human-readable current step, active stages, and suggested next commands.
 */
export function buildPipelineProgress(summary) {
  const counts = countByStatus(summary);
  const baseStages = PIPELINE_STAGES.map((stage) => ({
    id: stage.id,
    label: stage.label,
    status: stage.status,
    count: counts[stage.status] || 0,
    nextCommand: stage.nextCommand
  }));
  const publishStages = buildPublishStages(summary, counts[CONTENT_STATUSES.PUBLISH_PENDING] || 0);
  const stages = [
    ...baseStages,
    ...publishStages,
    {
      ...DONE_STAGE,
      count: counts[DONE_STAGE.status] || 0
    }
  ];
  const failedCount = counts[CONTENT_STATUSES.FAILED] || 0;
  const activeSteps = stages.filter((stage) => stage.count > 0);
  const currentStep =
    activeSteps.length > 1
      ? `병렬 진행 중: ${activeSteps.map((stage) => stage.label).join(', ')}`
      : activeSteps[0]?.label || '대기 중';
  const nextCommands = [...new Set(activeSteps.map((stage) => stage.nextCommand).filter(Boolean))];

  return {
    currentStep,
    activeSteps,
    nextCommands: nextCommands.length ? nextCommands : [COMMANDS.collect],
    failedCount,
    stages
  };
}
