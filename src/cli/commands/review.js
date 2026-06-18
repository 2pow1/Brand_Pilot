import { loadConfig } from '../../config.js';
import { checkDiscordReviewTarget, formatDiscordReviewError } from '../../review/discord.js';
import { createReviewRequest } from '../../review/index.js';
import { approveContent, rejectContent, requestReviewForContent } from '../../repository.js';
import { CONTENT_STATUSES } from '../../state.js';
import { openAppDatabase } from '../database.js';
import { parseOptions } from '../options.js';
import { printDatabaseInfo } from '../output.js';

/**
 * Sends or mocks Discord review requests for draft_created content.
 */
async function runReviewRequest(argv) {
  const options = parseOptions(argv);
  const config = loadConfig();
  const { store } = await openAppDatabase();
  const items = await store.listContentItemsByStatus(CONTENT_STATUSES.DRAFT_CREATED, {
    limit: options.limit
  });
  const requested = [];
  const failed = [];

  for (const item of items) {
    try {
      const review = await createReviewRequest({
        config,
        item,
        mock: options.mock
      });
      const updated = await requestReviewForContent(store, item, review.messageId, {
        mode: options.mock ? 'mock' : 'discord',
        channelId: review.channelId,
        url: review.url
      });

      requested.push({
        id: updated.id,
        draftTitle: updated.draft_title,
        status: updated.status,
        reviewMessageId: updated.review_message_id,
        url: review.url
      });
    } catch (error) {
      failed.push({
        id: item.id,
        draftTitle: item.draft_title,
        error: error.message
      });
    }
  }

  printDatabaseInfo(store);
  console.log(JSON.stringify({
    mode: options.mock ? 'mock' : 'discord',
    requestedCount: requested.length,
    failedCount: failed.length,
    requested,
    failed,
    summary: await store.summarize()
  }, null, 2));
  await store.close();
}

/**
 * Checks whether the configured Discord bot can see the review channel.
 */
async function runReviewCheck() {
  const config = loadConfig();

  try {
    const result = await checkDiscordReviewTarget({ config });

    console.log(JSON.stringify({
      ok: true,
      botId: result.botId,
      botUsername: result.botUsername,
      channelId: result.channelId,
      guildId: result.guildId,
      channelName: result.channelName,
      channelType: result.channelType
    }, null, 2));
  } catch (error) {
    console.error(formatDiscordReviewError(error));
    process.exitCode = 1;
  }
}

/**
 * Applies a manual approval or rejection decision from the CLI.
 */
async function runReviewDecision(action, argv) {
  const contentId = argv[0];
  if (!contentId) {
    throw new Error(`content-id is required for review ${action}`);
  }

  const { store } = await openAppDatabase();
  try {
    const item = await store.getContentItem(contentId);

    if (!item) {
      throw new Error(`Content item not found: ${contentId}`);
    }

    const updated =
      action === 'approve'
        ? await approveContent(store, item, { mode: 'manual-cli' })
        : await rejectContent(store, item, argv.slice(1).join(' ') || 'rejected', { mode: 'manual-cli' });

    printDatabaseInfo(store);
    console.log(JSON.stringify({
      id: updated.id,
      sourceTitle: updated.source_title,
      draftTitle: updated.draft_title,
      status: updated.status,
      summary: await store.summarize()
    }, null, 2));
  } finally {
    await store.close();
  }
}

/**
 * Dispatches review subcommands.
 */
export async function runReview(argv) {
  const action = argv[0];

  if (action === 'check') {
    await runReviewCheck();
  } else if (action === 'request') {
    await runReviewRequest(argv.slice(1));
  } else if (action === 'approve' || action === 'reject') {
    await runReviewDecision(action, argv.slice(1));
  } else {
    throw new Error('review command must be one of: check, request, approve, reject');
  }
}
