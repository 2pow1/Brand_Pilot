export const instagramSketchCardNewsV2EvalFixture = Object.freeze({
  requiredPromptSnippets: Object.freeze([
    'Prefer one-line titles when they fit naturally.',
    'Use the expanded space primarily for body copy, examples, contrast, and supporting details.',
    'Avoid under-filled content cards.',
    'Prefer one-line body copy when it fits naturally inside the card box.',
    'Do not split short body phrases under 18 visible characters.',
    'Template chrome options:',
    'Allowed values are normal, compact, and hidden.',
    'Before returning JSON, apply the text fit rules from the system prompt.'
  ]),
  cases: Object.freeze([
    Object.freeze({
      name: 'content_f204229e76e842ce',
      description: 'LinkedIn trust-building card news that previously exposed title/body fit regressions.',
      brand: Object.freeze({
        companyName: 'GrowthLine',
        brandVoice: 'clear and practical',
        serviceSummary: 'LinkedIn content strategy for small B2B brands',
        cta: Object.freeze({
          enabled: false,
          label: '',
          url: ''
        })
      }),
      item: Object.freeze({
        id: 'content_f204229e76e842ce',
        source_title: 'LinkedIn operation before starting',
        source_url: 'https://example.com/linkedin-before-starting',
        draft_title: '링크드인은 홍보 채널보다 신뢰를 쌓는 공간입니다',
        draft_body:
          '작은 브랜드일수록 더 많이 알리기 전에 믿을 이유를 보여줘야 합니다. 회사 소식만 반복하면 고객은 무엇을 물어봐야 할지 알기 어렵습니다. 대표의 관점, 고객이 겪는 문제, 해결 과정이 쌓일 때 신뢰가 만들어집니다.'
      }),
      channel: Object.freeze({
        id: 'instagram',
        name: 'Instagram',
        enabled: true,
        format: 'card_news',
        template: 'instagram-sketch-card-news-v2'
      }),
      adaptation: Object.freeze({
        content_title: '링크드인은 신뢰를 쌓는 공간',
        content_angle: '작은 B2B 브랜드가 링크드인을 홍보판이 아니라 신뢰 축적 공간으로 써야 하는 이유.',
        recommended_layout_flow: Object.freeze(['01', '03', '06', '04', '05', '09']),
        chrome: Object.freeze({
          header: 'normal',
          footer: 'normal'
        }),
        cover_image_prompt:
          'Editorial sketch-note scene for a small B2B brand building trust before promotion, warm paper texture, black ink lines, lime accent, quiet business desk, no readable text.',
        caption: '링크드인은 홍보보다 신뢰를 쌓는 공간입니다.',
        hashtags: Object.freeze(['GrowthLine', 'LinkedIn', 'B2B브랜딩']),
        cards: Object.freeze([
          Object.freeze({
            layout: '01',
            layout_name: 'Cover',
            usage_reason: 'Open with the core positioning of LinkedIn.',
            series: 'GrowthLine Note',
            kicker: 'LinkedIn 운영을 시작하기 전에',
            title: '링크드인은\n신뢰를 쌓는 공간입니다',
            subtitle: '작은 브랜드일수록\n더 많이 알리기 전에\n믿을 이유를 보여줘야 합니다'
          }),
          Object.freeze({
            layout: '03',
            layout_name: 'Problem / Solution',
            usage_reason: 'Show why company news does not create enough response.',
            title: '반응 없는 이유',
            problem_title: 'Problem',
            problem: '소식은 많지만\n고객 질문에는 답이 없습니다.\n믿을 단서가 보이지 않습니다.',
            solution_title: 'Solution',
            solution: '누구의 어떤 문제를\n반복해서 풀어왔는지\n짧고 꾸준히 보여줘야 합니다.'
          }),
          Object.freeze({
            layout: '06',
            layout_name: 'Before / After',
            usage_reason: 'Compare a promotion board with a trust-building board.',
            title: '회사 소식만 올릴 때',
            before: '출시 소식\n행사 참여\n제휴 뉴스\n채용 공고만 쌓입니다.',
            after: '고객의 고민\n대표의 관점\n해결 과정\n자주 받는 질문이 쌓입니다.'
          }),
          Object.freeze({
            layout: '04',
            layout_name: 'Customer Flow',
            usage_reason: 'Show the trust-building sequence.',
            title: '신뢰가 생기는 흐름',
            steps: Object.freeze([
              Object.freeze({
                title: '상황 포착',
                description: '고객이 이미 겪는 문제에서 시작'
              }),
              Object.freeze({
                title: '관점 제시',
                description: '우리는 어떻게 보는지 짧게 설명'
              }),
              Object.freeze({
                title: '단서 축적',
                description: '사례와 과정을 반복해서 남김'
              })
            ])
          }),
          Object.freeze({
            layout: '05',
            layout_name: 'Checklist',
            usage_reason: 'Give a practical pre-posting checklist.',
            title: '먼저 볼 4가지',
            items: Object.freeze([
              '프로필과 페이지가 같은 말을 하는가',
              '한 문장으로 대상이 보이는가',
              '고객 상황에서 글이 시작되는가',
              '성과보다 과정과 기준을 보여주는가'
            ])
          }),
          Object.freeze({
            layout: '09',
            layout_name: 'Closing',
            usage_reason: 'Close with a save-worthy reminder.',
            title: '홍보보다 신뢰',
            description: '먼저 믿을 이유가 쌓이면\n홍보는 덜 밀어붙여도 됩니다.',
            cta: '저장하고 다음 게시물 전에 확인해보세요.'
          })
        ])
      }),
      expectations: Object.freeze({
        maxTitleFit: 'tight',
        maxContentFit: 'tight',
        expectedLayouts: Object.freeze(['01', '03', '06', '04', '05', '09']),
        coverPromptPattern: 'no readable text'
      })
    })
  ])
});
