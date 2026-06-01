import { buildDoctorReportWithRemoteChecks } from '../doctor.js';
import { checkDiscordReviewTarget } from '../review/discord.js';

/**
 * Finds the Meta access token expiry warning emitted by the publish doctor.
 */
function findExpiryWarning(report) {
  return report.checks.find((check) => (
    check.name === 'META_ACCESS_TOKEN_EXPIRY' && ['warning', 'expired'].includes(check.status)
  ));
}

/**
 * Builds the Discord message that tells the operator to refresh the Meta token.
 */
export function buildMetaTokenExpiryAlertMessage(check) {
  const expiresAt = check.details?.expiresAt || 'unknown';
  const remainingDays = check.details?.remainingDays ?? 'unknown';
  const warningDays = check.details?.warningDays ?? 'unknown';

  return [
    check.status === 'expired'
      ? '[Brand Pilot] Meta access token이 만료되었습니다.'
      : '[Brand Pilot] Meta access token 만료가 가까워졌습니다.',
    '',
    `- 만료 시각: ${expiresAt}`,
    `- 남은 기간: ${remainingDays}일`,
    `- 경고 기준: ${warningDays}일 이하`,
    '',
    '조치: Meta long-lived token을 다시 발급한 뒤 로컬 `.env`와 GitHub Actions Secret `META_ACCESS_TOKEN`을 교체하세요.'
  ].join('\n');
}

/**
 * Sends a Discord warning when the publish doctor reports a near-expiring Meta token.
 */
export async function sendMetaTokenExpiryWarning({ config, fetchImpl = fetch, now = new Date() }) {
  const report = await buildDoctorReportWithRemoteChecks(config, 'publish', {
    fetchImpl,
    now
  });
  const warning = findExpiryWarning(report);
  const missingAppCredentials = report.checks.find((check) => check.name === 'META_APP_CREDENTIALS');

  if (!warning) {
    return {
      sent: false,
      reason: missingAppCredentials ? 'meta_app_credentials_missing' : 'not_expiring_soon'
    };
  }

  if (!config.discordBotToken || !config.discordReviewChannelId) {
    return {
      sent: false,
      reason: 'discord_not_configured',
      expiresAt: warning.details?.expiresAt || '',
      remainingDays: warning.details?.remainingDays
    };
  }

  const target = await checkDiscordReviewTarget({ config, fetchImpl });
  const response = await fetchImpl(`${config.discordBaseUrl}/channels/${config.discordReviewChannelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${config.discordBotToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: buildMetaTokenExpiryAlertMessage(warning),
      allowed_mentions: {
        parse: []
      }
    })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || `Discord token alert failed: HTTP ${response.status}`);
  }

  return {
    sent: true,
    messageId: payload.id || '',
    channelId: payload.channel_id || target.channelId,
    expiresAt: warning.details?.expiresAt || '',
    remainingDays: warning.details?.remainingDays
  };
}
