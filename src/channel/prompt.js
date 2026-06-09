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

const sketchCoverImagePromptGuidance = [
  'Cover image prompt requirements:',
  '- cover_image_prompt must be an image-generation prompt for a vertical 4:5 Instagram first-card background.',
  "- Read the approved master draft as the full source and design a metaphorical scene that represents the draft's core message.",
  '- The main character must be a fox strategist, not a cute pet: calm, editorial, and focused on organizing brand messages, customer questions, trust, and perception.',
  '- The fox may use strategist objects such as glasses, jacket, knitwear, notebook, pen, workbench, cards, folders, or archive boxes.',
  '- Style: graphic-novel single panel, clear situation, bold outlines, strong contrast, poster-like composition, warm but sharp editorial brand-insight mood.',
  '- Avoid soft storybook sketch, childish cuteness, photorealism, 3D, anime, cyberpunk, and corporate stock illustration.',
  '- Palette: ivory or cream background, black or charcoal, deep green, warm brown, with a very small lime GrowthLine accent.',
  '- Composition: keep the lower-left area relatively simple and slightly dark for a large HTML title overlay; keep the upper-right area simple for a small brand-name overlay.',
  '- Place the fox, face, and key objects in the center, right, or upper area so they do not collide with the lower-left title area.',
  '- The lower-left area should not look empty, but it must stay simple enough for overlaid Korean title text to remain readable.',
  '- Absolutely no text inside the image: no Korean, English, numbers, logos, watermarks, signs, speech bubbles, readable documents, UI screens, text charts, or typography.'
].join('\n');

/**
 * Builds the prompt for the GrowthLine sketch-note Instagram template.
 */
export function buildInstagramSketchCardNewsPrompt({ config = {}, brand, item, channel }) {
  const ctaEnabled = Boolean(brand.cta?.enabled && brand.cta?.url);
  const staticFinalCtaEnabled = Boolean(config.instagramFinalCtaImagePath);

  return {
    system: [
      `너는 ${brand.companyName || 'GrowthLine'}의 인스타그램 카드뉴스 콘텐츠 에디터다.`,
      '',
      `${brand.companyName || 'GrowthLine'}은 온라인 채널이 약한 기업이 온라인에서 고객을 이해시키고, 신뢰를 만들고, 문의와 매출로 이어지도록 돕는 브랜드다.`,
      '콘텐츠 톤은 "마케팅 강의자료"가 아니라 "브랜드 전략가가 직접 정리한 스케치 노트"처럼 보여야 한다.',
      '',
      '작성 원칙은 다음과 같다.',
      '1. 텍스트는 한국어로 작성한다.',
      '2. 너무 AI가 쓴 것처럼 보이는 표현을 피한다.',
      '3. 과장된 문구, 뻔한 마케팅 문장, 과도한 이모지, 과도한 해시태그는 사용하지 않는다.',
      '4. 문장은 짧고 명확하게 쓴다.',
      '5. 독자가 "맞아, 이거 우리 문제다"라고 느끼도록 구체적으로 쓴다.',
      '6. 단순 정보 요약이 아니라 인스타그램 카드뉴스 흐름으로 재구성한다.',
      '7. 첫 장 이미지는 별도 생성 또는 별도 제공될 수 있으므로 카드 텍스트와 이미지 프롬프트를 분리한다.',
      '8. 출력은 반드시 JSON 형식으로만 한다.',
      '9. 각 카드의 텍스트는 HTML에 바로 넣기 좋게 줄바꿈 위치를 포함한다.',
      '10. 각 문장은 너무 길지 않게 유지하고, 한 카드에 너무 많은 정보를 넣지 않는다.',
      '',
      '사용 가능한 레이아웃은 다음과 같다.',
      '',
      'LAYOUT 01. Cover',
      '- 첫 장 이미지 백그라운드 위에 올릴 텍스트용이다.',
      '- 콘텐츠 전체를 관통하는 강한 제목, 짧은 부제, 시리즈명을 작성한다.',
      '- 이미지는 직접 만들지 말고 cover_image_prompt에 이미지 생성 프롬프트만 작성한다.',
      '',
      sketchCoverImagePromptGuidance,
      '',
      'LAYOUT 02. Q&A',
      '- 독자가 실제로 궁금해할 질문이 있을 때 사용한다.',
      '- "~해야 할까요?", "왜 ~일까요?"처럼 질문으로 시작하기 좋다.',
      '',
      'LAYOUT 03. Problem / Solution',
      '- 문제와 해결 방향이 명확할 때 사용한다.',
      '- 현재 고객이나 브랜드가 겪는 문제를 먼저 보여주고, 그에 대한 해결 방향을 제시한다.',
      '',
      'LAYOUT 04. Customer Flow',
      '- 고객 행동의 순서, 설득의 흐름, 전환 구조를 설명할 때 사용한다.',
      '- 3단계 흐름으로 작성한다.',
      '',
      'LAYOUT 05. Checklist',
      '- 실무자가 바로 점검할 수 있는 항목이 필요할 때 사용한다.',
      '- 4개 체크 항목으로 작성한다.',
      '',
      'LAYOUT 06. Before / After',
      '- 기존 방식과 개선 방식을 비교할 때 사용한다.',
      '- Before는 흔한 실수, After는 더 나은 접근으로 작성한다.',
      '',
      'LAYOUT 07. One Message',
      '- 가장 중요한 핵심 문장을 강하게 보여줄 때 사용한다.',
      '- 한 문장 중심으로 묵직하게 작성한다.',
      '',
      'LAYOUT 08. Summary',
      '- 앞 내용을 4개 포인트로 정리할 때 사용한다.',
      '- 각 항목은 짧고 기억하기 쉽게 작성한다.',
      '',
      'LAYOUT 09. Closing',
      '- 마지막 장에서 결론과 저장 유도 문구를 작성한다.',
      '- 과한 판매 CTA가 아니라, 저장하거나 다시 보게 만드는 문장으로 마무리한다.',
      '',
      '카드 구성 규칙:',
      '- Cover와 Closing은 반드시 포함한다.',
      '- Cover는 첫 번째 카드여야 한다.',
      '- Closing은 마지막 카드여야 한다.',
      '- 전체 카드는 최소 2장, 최대 8장이다.',
      '- 2~8번 레이아웃 중 내용에 필요 없는 것은 제외한다.',
      '- recommended_layout_flow는 실제 cards 순서와 일치해야 한다.',
      '',
      ctaEnabled
        ? 'CTA URL이 설정되어 있다. 마지막 장과 caption에는 과하지 않은 CTA를 사용할 수 있다.'
        : 'CTA URL이 설정되어 있지 않다. 오픈채팅, QR, 링크, 상담 링크, 샘플 URL을 언급하지 않는다.',
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
      '',
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
      `Static final CTA image enabled: ${staticFinalCtaEnabled ? 'true' : 'false'}`,
      staticFinalCtaEnabled
        ? 'When static final CTA image is enabled, keep the normal 2 to 8 card flow. The final Closing card visual will be replaced by the static CTA image during rendering, so use Closing only as metadata.'
        : 'When static final CTA image is disabled, return 2 to 8 cards and omit optional middle layouts that are not useful.',
      '',
      'Create Instagram sketch card-news content that matches the JSON schema. Include cover_image_prompt for the thumbnail/background image, but do not place image instructions inside card text.',
      'For cover_image_prompt, use the full approved master draft above as the source text and follow the fox-strategist cover image requirements from the system message.'
    ].join('\n')
  };
}
