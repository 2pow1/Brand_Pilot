/**
 * Creates deterministic local draft content for pipeline tests without calling OpenAI.
 */
export function createMockDraft({ brand, item }) {
  const companyName = brand.companyName || 'Client Company';
  const ctaLabel = brand.cta?.label || 'Join the open chat';
  const ctaUrl = brand.cta?.url || '';
  const hook = '홍보를 열심히 하는데도 고객 반응이 일정하지 않다면, 메시지의 양보다 구조를 먼저 봐야 합니다.';

  return {
    title: `[검수 초안] ${item.source_title}`,
    hook,
    body: [
      hook,
      `"${item.source_title}"에서 가져올 수 있는 시사점은 작은 사업의 홍보도 단순 노출보다 고객이 이해할 수 있는 기준을 만들어야 한다는 점입니다.`,
      `${companyName}은 브랜드의 강점, 고객이 실제로 반응하는 문장, 채널별 콘텐츠 흐름을 정리해 대표가 본업에 집중할 수 있게 돕습니다.`,
      `관심이 있다면 ${ctaLabel}을 통해 다음 홍보 방향을 함께 점검해보세요.`
    ].join('\n\n'),
    angle: 'problem-awareness',
    keyPoints: [
      '작은 사업에는 더 많은 콘텐츠보다 반복 가능한 홍보 구조가 필요함',
      '외부 인사이트를 자사 서비스 메시지로 재구성함',
      '채널별 콘텐츠 확장 전에 공통 초안을 먼저 검수함'
    ],
    cta: ctaLabel,
    ctaUrl,
    suggestedRepurpose: {
      instagram: '문제 인식 중심의 5장 카드뉴스로 확장',
      blog: '작은 사업 홍보 구조를 점검하는 설명형 글로 확장',
      linkedin: '브랜딩 지원 경험과 실무 관점을 담은 짧은 인사이트로 확장'
    }
  };
}
