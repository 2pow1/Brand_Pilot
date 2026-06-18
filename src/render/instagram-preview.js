/**
 * Builds a deterministic v2 preview payload without reading or mutating the database.
 */
export function createInstagramSketchPreviewPayload({ brand = {} } = {}) {
  const brandName = brand.companyName || 'GrowthLine';

  return {
    channelId: 'instagram',
    brandName,
    format: 'card_news',
    template: 'instagram-sketch-card-news-v2',
    dimensions: {
      width: 1080,
      height: 1350
    },
    design: {
      background: '#f7f1e3',
      foreground: '#151515',
      muted: '#706b61',
      accent: '#c9f24d',
      border: '#1c1c1c',
      templateStyle: 'sketch-note'
    },
    contentTitle: 'Preview: clearer customer signal',
    contentAngle: 'Checks how the v2 sketch template handles supported card layouts.',
    recommendedLayoutFlow: ['01', '02', '03', '04', '05', '06', '07', '09'],
    chrome: {
      header: 'normal',
      footer: 'normal'
    },
    coverImagePrompt:
      'A hand-drawn brand strategy sketch note background for a small business marketing insight, warm paper texture, black ink lines, lime accent, no readable text.',
    cards: [
      {
        index: 1,
        page: '1/8',
        layout: '01',
        layout_name: 'Cover',
        usage_reason: 'Preview the first fixed cover card.',
        series: `${brandName} Note`,
        kicker: 'BRAND NOTE',
        title: 'Customers read\nsignals first',
        subtitle: 'Clear positioning makes the next action easier.'
      },
      {
        index: 2,
        page: '2/8',
        layout: '02',
        layout_name: 'Q&A',
        usage_reason: 'Preview a question-led explanation card.',
        question_label: 'Question',
        question: 'Why does promotion fail even when effort is high?',
        answer_label: 'Answer',
        answer: 'Because customers often see scattered messages before they understand the offer.'
      },
      {
        index: 3,
        page: '3/8',
        layout: '03',
        layout_name: 'Problem / Solution',
        usage_reason: 'Preview a direct problem and solution comparison.',
        title: 'The real issue is usually structure',
        problem_title: 'Problem',
        problem: 'Each channel says something slightly different, so the business feels unclear.',
        solution_title: 'Solution',
        solution: 'Start from one customer problem, then adapt the same message by channel.'
      },
      {
        index: 4,
        page: '4/8',
        layout: '04',
        layout_name: 'Customer Flow',
        usage_reason: 'Preview a three-step customer understanding flow.',
        title: 'A simple customer flow',
        steps: [
          {
            title: 'Notice',
            description: 'The customer recognizes a familiar business problem.'
          },
          {
            title: 'Understand',
            description: 'The message explains why the problem keeps happening.'
          },
          {
            title: 'Trust',
            description: 'The solution feels practical enough to consider.'
          }
        ]
      },
      {
        index: 5,
        page: '5/8',
        layout: '05',
        layout_name: 'Checklist',
        usage_reason: 'Preview a compact review checklist.',
        title: 'Before publishing, check this',
        items: [
          'Is the customer problem specific?',
          'Can the offer be understood in one read?',
          'Does the channel copy keep the same core message?',
          'Is the next action visible without pressure?'
        ]
      },
      {
        index: 6,
        page: '6/8',
        layout: '06',
        layout_name: 'Before / After',
        usage_reason: 'Preview a before and after contrast card.',
        title: 'Small copy changes can change trust',
        before: 'We provide branding and marketing services.',
        after: 'We help small businesses make their offer easier to understand online.'
      },
      {
        index: 7,
        page: '7/8',
        layout: '07',
        layout_name: 'One Message',
        usage_reason: 'Preview a single emphasis card.',
        title: 'More posts do not fix an unclear message.',
        description: 'A clearer customer signal should come before more channel activity.'
      },
      {
        index: 8,
        page: '8/8',
        layout: '09',
        layout_name: 'Closing',
        usage_reason: 'Preview the last fixed closing card.',
        title: 'Save this before\nplanning the next post',
        description: `${brandName} organizes brand and promotion messages so small businesses can be understood faster.`,
        cta: 'Use it as a quick message check.'
      }
    ],
    caption:
      'Customers understand a business faster when every channel carries the same clear signal.',
    hashtags: ['#GrowthLine', '#Branding', '#SmallBusinessMarketing'],
    source: {
      title: 'Local v2 preview payload',
      url: ''
    },
    generation: {
      mode: 'local-preview',
      schema: 'instagram-sketch-card-news-v2'
    }
  };
}
