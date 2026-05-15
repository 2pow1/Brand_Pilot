import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReviewComponents, buildReviewContent, buildReviewPayload } from '../src/review/message.js';
import {
  checkDiscordReviewTarget,
  createMockReviewRequest,
  formatDiscordReviewError,
  sendDiscordReviewRequest
} from '../src/review/discord.js';

const item = {
  id: 'content_123',
  source_name: 'Source A',
  source_title: 'Source title',
  source_url: 'https://example.com/article',
  draft_title: 'Draft title',
  draft_body: 'Draft body'
};

test('builds a Discord review message with approval controls', () => {
  const payload = buildReviewPayload(item);
  const components = buildReviewComponents(item.id);

  assert.match(buildReviewContent(item), /콘텐츠 ID: content_123/);
  assert.equal(payload.allowed_mentions.parse.length, 0);
  assert.equal(components[0].components[0].label, '승인');
  assert.equal(components[0].components[1].label, '거절');
  assert.equal(components[0].components[0].custom_id, 'brandpilot:approve:content_123');
  assert.equal(components[0].components[1].custom_id, 'brandpilot:reject:content_123');
});

test('creates deterministic mock review request metadata', () => {
  const review = createMockReviewRequest(item);

  assert.equal(review.messageId, 'mock_review_content_123');
  assert.equal(review.channelId, 'mock');
});

test('checks Discord bot and review channel access', async () => {
  const calls = [];
  const result = await checkDiscordReviewTarget({
    config: {
      discordBotToken: 'bot-token',
      discordReviewChannelId: 'channel_123',
      discordBaseUrl: 'https://discord.test/api/v10'
    },
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).endsWith('/users/@me')) {
        return Response.json({ id: 'bot_1', username: 'BrandPilot' });
      }
      return Response.json({ id: 'channel_123', guild_id: 'guild_123', name: 'reviews', type: 0 });
    }
  });

  assert.deepEqual(calls, [
    'https://discord.test/api/v10/users/@me',
    'https://discord.test/api/v10/channels/channel_123'
  ]);
  assert.equal(result.botUsername, 'BrandPilot');
  assert.equal(result.guildId, 'guild_123');
  assert.equal(result.channelName, 'reviews');
});

test('explains Discord review channel access failures', async () => {
  await assert.rejects(
    checkDiscordReviewTarget({
      config: {
        discordBotToken: 'bot-token',
        discordReviewChannelId: 'channel_123',
        discordBaseUrl: 'https://discord.test/api/v10'
      },
      fetchImpl: async (url) => {
        if (String(url).endsWith('/users/@me')) {
          return Response.json({ id: 'bot_1', username: 'BrandPilot' });
        }
        return Response.json({ message: 'Missing Access', code: 50001 }, { status: 403 });
      }
    }),
    (error) => {
      assert.equal(error.message, 'Missing Access');
      assert.equal(error.status, 403);
      assert.equal(error.code, 50001);
      assert.match(error.hint, /DISCORD_REVIEW_CHANNEL_ID/);
      assert.match(error.hint, /View Channel/);
      assert.match(formatDiscordReviewError(error), /Discord code 50001/);
      return true;
    }
  );
});

test('sends a Discord review request after checking the target channel', async () => {
  const calls = [];
  const review = await sendDiscordReviewRequest({
    config: {
      discordBotToken: 'bot-token',
      discordReviewChannelId: 'channel_123',
      discordBaseUrl: 'https://discord.test/api/v10'
    },
    item,
    fetchImpl: async (url, options = {}) => {
      calls.push({
        url: String(url),
        method: options.method || 'GET',
        body: options.body || ''
      });
      if (String(url).endsWith('/users/@me')) {
        return Response.json({ id: 'bot_1', username: 'BrandPilot' });
      }
      if (String(url).endsWith('/channels/channel_123')) {
        return Response.json({ id: 'channel_123', guild_id: 'guild_123', name: 'reviews', type: 0 });
      }
      return Response.json({
        id: 'message_123',
        channel_id: 'channel_123'
      });
    }
  });

  assert.equal(review.messageId, 'message_123');
  assert.equal(review.url, 'https://discord.com/channels/guild_123/channel_123/message_123');
  assert.equal(calls.at(-1).method, 'POST');
  assert.match(calls.at(-1).body, /brandpilot:approve:content_123/);
});
