export function buildDraftPrompt({ brand, item }) {
  return {
    system: [
      'You write Korean marketing drafts for a company that provides branding and promotion services to other businesses.',
      'Use the source material only as inspiration for a self-promotion angle.',
      'Do not summarize the source article as the final content.',
      'Write for small business owners and side-business operators who feel stuck with promotion.',
      'Return JSON only.'
    ].join('\n'),
    user: [
      `Company: ${brand.companyName}`,
      `Brand voice: ${brand.brandVoice}`,
      `Service summary: ${brand.serviceSummary}`,
      `CTA label: ${brand.cta?.label || ''}`,
      `CTA URL: ${brand.cta?.url || ''}`,
      '',
      'Source candidate:',
      `- Source: ${item.source_name}`,
      `- Title: ${item.source_title}`,
      `- URL: ${item.source_url}`,
      `- Excerpt: ${item.raw_excerpt || '(none)'}`,
      '',
      'Create a common draft for human review before channel-specific formatting.',
      'The draft should be useful for later Instagram card news, blog, Facebook, and LinkedIn variants.',
      'Keep the body concise enough for a reviewer to approve quickly.'
    ].join('\n')
  };
}
