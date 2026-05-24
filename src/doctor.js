const TARGETS = Object.freeze({
  SCHEDULE: 'schedule',
  DISCORD: 'discord',
  PUBLISH: 'publish',
  NOTION: 'notion'
});

const CHECKS = Object.freeze({
  [TARGETS.SCHEDULE]: [
    {
      name: 'DATABASE_PROVIDER',
      key: 'databaseProvider',
      expected: 'supabase',
      message: 'GitHub Actions scheduled pipeline must use DATABASE_PROVIDER=supabase.'
    },
    {
      name: 'SUPABASE_URL',
      key: 'supabaseUrl',
      message: 'Required for status checks and pipeline state storage.'
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      key: 'supabaseServiceRoleKey',
      message: 'Required for Supabase REST writes from GitHub Actions.'
    },
    {
      name: 'OPENAI_API_KEY',
      key: 'openaiApiKey',
      message: 'Required for the scheduled draft generation step.'
    },
    {
      name: 'DISCORD_BOT_TOKEN',
      key: 'discordBotToken',
      message: 'Required for the scheduled Discord review request step.'
    },
    {
      name: 'DISCORD_REVIEW_CHANNEL_ID',
      key: 'discordReviewChannelId',
      message: 'Required for the scheduled Discord review request step.'
    }
  ],
  [TARGETS.DISCORD]: [
    {
      name: 'DISCORD_BOT_TOKEN',
      key: 'discordBotToken',
      message: 'Required for sending review requests to Discord.'
    },
    {
      name: 'DISCORD_REVIEW_CHANNEL_ID',
      key: 'discordReviewChannelId',
      message: 'Required for choosing the Discord review channel.'
    },
    {
      name: 'DISCORD_PUBLIC_KEY',
      key: 'discordPublicKey',
      message: 'Required for verifying Discord button interaction signatures.'
    },
    {
      name: 'SUPABASE_URL',
      key: 'supabaseUrl',
      message: 'Required by the Discord interaction Edge Function.'
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      key: 'supabaseServiceRoleKey',
      message: 'Required by the Discord interaction Edge Function.'
    }
  ],
  [TARGETS.PUBLISH]: [
    {
      name: 'META_ACCESS_TOKEN',
      key: 'metaAccessToken',
      message: 'Required for Instagram Graph API publishing.'
    },
    {
      name: 'INSTAGRAM_BUSINESS_ACCOUNT_ID',
      key: 'instagramBusinessAccountId',
      message: 'Required for Instagram Graph API publishing.'
    },
    {
      name: 'SUPABASE_STORAGE_BUCKET',
      key: 'supabaseStorageBucket',
      message: 'Required before uploading rendered Instagram images.'
    }
  ],
  [TARGETS.NOTION]: [
    {
      name: 'NOTION_TOKEN',
      key: 'notionToken',
      message: 'Required for mirroring content records to Notion.'
    },
    {
      name: 'NOTION_DATA_SOURCE_ID',
      key: 'notionDataSourceId',
      message: 'Required for choosing the Notion data source that receives mirror pages.'
    }
  ]
});

/**
 * Determines whether a doctor check should fail the command.
 */
function isBlockingFailure(result) {
  return !result.ok;
}

/**
 * Chooses a stable log label for a doctor check result.
 */
function formatStatusLabel(check) {
  if (check.ok && check.status === 'warning') return 'warn';
  if (check.ok) return 'ok';
  if (check.status === 'expired') return 'expired';
  if (check.status === 'missing_scope') return 'missing_scope';
  if (check.status === 'invalid') return 'invalid';
  return 'missing';
}

/**
 * Evaluates one configuration requirement without including secret values in the result.
 */
function checkConfigValue(config, check) {
  const value = config[check.key];
  const configured = typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
  const matchesExpected = check.expected === undefined || value === check.expected;
  const ok = configured && matchesExpected;

  return {
    name: check.name,
    ok,
    status: ok ? 'ok' : 'missing_or_invalid',
    message: ok ? '' : check.message
  };
}

/**
 * Builds a preflight report from an explicit set of checks.
 */
function reportFromChecks(target, results) {
  const failures = results.filter(isBlockingFailure);

  return {
    target,
    ok: failures.length === 0,
    missing: failures.map((result) => result.name),
    checks: results
  };
}

/**
 * Builds a preflight report for a workflow target such as schedule or publish.
 */
export function buildDoctorReport(config, target = TARGETS.SCHEDULE) {
  const checks = CHECKS[target];

  if (!checks) {
    throw new Error(`Unknown doctor target: ${target}`);
  }

  const results = checks.map((check) => checkConfigValue(config, check));

  return reportFromChecks(target, results);
}

/**
 * Builds a preflight report and includes remote checks when the target needs them.
 */
export async function buildDoctorReportWithRemoteChecks(
  config,
  target = TARGETS.SCHEDULE,
  { fetchImpl = fetch, now = new Date() } = {}
) {
  const report = buildDoctorReport(config, target);

  if (target !== TARGETS.PUBLISH || !report.ok) {
    return report;
  }

  const { buildMetaPublishChecks } = await import('./meta/token.js');
  const remoteChecks = await buildMetaPublishChecks({ config, fetchImpl, now });

  return reportFromChecks(target, [
    ...report.checks,
    ...remoteChecks
  ]);
}

/**
 * Formats a doctor report for CLI and GitHub Actions logs.
 */
export function formatDoctorReport(report) {
  const lines = [
    `Doctor target: ${report.target}`,
    `Status: ${report.ok ? 'ok' : 'failed'}`
  ];

  for (const check of report.checks) {
    lines.push(`[${formatStatusLabel(check)}] ${check.name}${check.message ? ` - ${check.message}` : ''}`);
  }

  return lines.join('\n');
}
