/**
 * Creates deterministic local draft content for pipeline tests without calling OpenAI.
 */
export function createMockDraft({ brand, item }) {
  const companyName = brand.companyName || 'Client Company';
  const ctaLabel = brand.cta?.label || '상담 채널 확인하기';

  return {
    title: `[검수 초안] ${item.source_title}`,
    body: [
      `요즘 작은 사업을 운영하는 대표님에게 필요한 것은 더 많은 홍보물이 아니라, 반복해서 쓸 수 있는 홍보 구조입니다.`,
      `"${item.source_title}"에서 얻을 수 있는 힌트는 ${companyName}의 메시지로 바꾸면 더 선명해집니다.`,
      `${companyName}은 브랜드의 강점, 고객이 반응할 문장, 채널별 콘텐츠 흐름을 정리해 대표님이 본업에 더 집중할 수 있게 돕습니다.`,
      `관심 있다면 ${ctaLabel}를 통해 다음 홍보 방향을 함께 점검해보세요.`
    ].join('\n\n'),
    angle: '작은 사업자가 홍보를 막막해하지 않도록 구조화된 브랜딩/콘텐츠 지원을 제안',
    keyPoints: [
      '더 많은 콘텐츠보다 반복 가능한 홍보 구조가 필요함',
      '외부 인사이트를 자사 서비스 메시지로 재구성함',
      '채널별 콘텐츠 확장 전에 공통 초안을 먼저 검수함'
    ],
    cta: ctaLabel
  };
}
