/**
 * Builds the channel-specific prompt used after human approval of the master draft.
 */
export function buildInstagramChannelPrompt({ brand, item, channel }) {
  const ctaEnabled = Boolean(brand.cta?.enabled && brand.cta?.url);

  return {
    system: [
      'You adapt an approved Korean master marketing draft into Instagram card-news content.',
      '',
      'The master draft has already been reviewed by a human. Do not change the main claim or invent new facts.',
      'Your job is channel-specific adaptation: clearer slide sequencing, shorter card copy, Instagram caption, and hashtags.',
      '',
      'Write Korean copy for small business owners, one-person businesses, and side-business operators.',
      'Use a clear, practical, founder-friendly tone.',
      'Avoid hype, vague motivation, and generic branding cliches.',
      '',
      'Return exactly five slides.',
      'Each slide should be concise enough for a 1080x1080 card-news layout.',
      'Prefer short, strong headlines and practical body copy.',
      '',
      ctaEnabled
        ? 'A CTA URL is configured. The final slide may use a soft CTA and the caption may include the CTA.'
        : 'No CTA URL is configured. Do not mention open chat, QR, link in bio, consultation link, or any sample URL.',
      '',
      'Return JSON only.'
    ].join('\n'),
    user: [
      `Company: ${brand.companyName}`,
      `Brand voice: ${brand.brandVoice}`,
      `Service summary: ${brand.serviceSummary}`,
      `CTA enabled: ${ctaEnabled ? 'true' : 'false'}`,
      `CTA label: ${ctaEnabled ? brand.cta?.label || '' : ''}`,
      `CTA URL: ${ctaEnabled ? brand.cta?.url || '' : ''}`,
      'Channel:',
      `- ID: ${channel.id}`,
      `- Format: ${channel.format}`,
      `- Template: ${channel.template}`,
      '',
      'Source:',
      `- Title: ${item.source_title}`,
      `- URL: ${item.source_url}`,
      '',
      'Approved master draft:',
      `- Title: ${item.draft_title}`,
      `- Body: ${item.draft_body}`,
      '',
      'Create Instagram card-news content that matches this JSON schema:',
      '{',
      '  "slides": [',
      '    { "role": "hook", "label": "", "headline": "", "body": "", "emphasis": "" },',
      '    { "role": "problem", "label": "", "headline": "", "body": "", "emphasis": "" },',
      '    { "role": "insight", "label": "", "headline": "", "body": "", "emphasis": "" },',
      '    { "role": "solution", "label": "", "headline": "", "body": "", "emphasis": "" },',
      '    { "role": "closing", "label": "", "headline": "", "body": "", "emphasis": "" }',
      '  ],',
      '  "caption": "",',
      '  "hashtags": [],',
      '  "visual_notes": ""',
      '}'
    ].join('\n')
  };
}

export { buildInstagramSketchCardNewsPrompt } from '../prompts/instagram/sketch-card-news-v2/prompt.js';
