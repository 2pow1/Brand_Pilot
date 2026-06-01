import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sendMetaTokenExpiryWarning } from '../src/alert/meta-token.js';

const baseConfig = {
  metaAccessToken: 'meta-token',
  metaAppId: 'app-id',
  metaAppSecret: 'app-secret',
  metaTokenExpiryWarningDays: 7,
  metaGraphBaseUrl: 'https://graph.facebook.com/v25.0',
  instagramBusinessAccountId: 'ig-123',
  supabaseStorageBucket: 'brand-pilot-instagram',
  discordBotToken: 'discord-token',
  discordReviewChannelId: 'channel-123',
  discordBaseUrl: 'https://discord.com/api/v10'
};

function createAlertFetch({ expiresAtSeconds }) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const value = String(url);
    calls.push({ url: value, options });

    if (value.includes('/debug_token')) {
      return Response.json({
        data: {
          is_valid: true,
          expires_at: expiresAtSeconds,
          scopes: ['instagram_basic', 'instagram_content_publish']
        }
      });
    }

    if (value.includes('/ig-123')) {
      return Response.json({ id: 'ig-123' });
    }

    if (value.includes('/me/accounts')) {
      return Response.json({ data: [] });
    }

    if (value.endsWith('/users/@me')) {
      return Response.json({ id: 'bot-123', username: 'Brand_Pilot' });
    }

    if (value.endsWith('/channels/channel-123') && !options.method) {
      return Response.json({ id: 'channel-123', name: 'ch_bot', type: 0, guild_id: 'guild-123' });
    }

    if (value.endsWith('/channels/channel-123/messages')) {
      return Response.json({ id: 'message-123', channel_id: 'channel-123' });
    }

    throw new Error(`Unexpected URL: ${value}`);
  };

  return { calls, fetchImpl };
}

test('sends a Discord warning when Meta token expires within the warning window', async () => {
  const now = new Date('2026-05-20T00:00:00.000Z');
  const { calls, fetchImpl } = createAlertFetch({
    expiresAtSeconds: Math.floor(new Date('2026-05-22T00:00:00.000Z').getTime() / 1000)
  });
  const result = await sendMetaTokenExpiryWarning({
    config: baseConfig,
    fetchImpl,
    now
  });

  assert.equal(result.sent, true);
  assert.equal(result.messageId, 'message-123');
  assert.equal(result.remainingDays, 2);

  const messageCall = calls.find((call) => call.url.endsWith('/channels/channel-123/messages'));
  assert.ok(messageCall);
  const body = JSON.parse(messageCall.options.body);
  assert.match(body.content, /Meta access token/);
  assert.match(body.content, /META_ACCESS_TOKEN/);
});

test('skips Discord warning when Meta token is not expiring soon', async () => {
  const now = new Date('2026-05-20T00:00:00.000Z');
  const { calls, fetchImpl } = createAlertFetch({
    expiresAtSeconds: Math.floor(new Date('2026-06-20T00:00:00.000Z').getTime() / 1000)
  });
  const result = await sendMetaTokenExpiryWarning({
    config: baseConfig,
    fetchImpl,
    now
  });

  assert.deepEqual(result, {
    sent: false,
    reason: 'not_expiring_soon'
  });
  assert.equal(calls.some((call) => call.url.endsWith('/channels/channel-123/messages')), false);
});
