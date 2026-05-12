import { createMockReviewRequest, sendDiscordReviewRequest } from './discord.js';

export async function createReviewRequest({ config, item, mock = false }) {
  if (mock) {
    return createMockReviewRequest(item);
  }

  return sendDiscordReviewRequest({ config, item });
}
