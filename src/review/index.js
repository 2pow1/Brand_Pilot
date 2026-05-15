import { createMockReviewRequest, sendDiscordReviewRequest } from './discord.js';

/**
 * Creates a Discord review request or a deterministic mock request for local testing.
 */
export async function createReviewRequest({ config, item, mock = false }) {
  if (mock) {
    return createMockReviewRequest(item);
  }

  return sendDiscordReviewRequest({ config, item });
}
