const DEFAULT_CARD_COUNT = 3;
const MIN_CARD_COUNT = 1;
const MAX_CARD_COUNT = 10;

export const CLIENT_CARD_NEWS_PROMPT = `너는 인스타그램용 카드뉴스를 제작하는 디자이너이자 콘텐츠 에디터다.

아래에 제공하는 원문/메모/요약 내용을 바탕으로,
인스타그램에 바로 업로드할 수 있는 카드뉴스 이미지를 제작해줘.

[입력 내용]
본문 정리

작업 목표:

입력된 내용을 먼저 읽고 핵심 메시지를 정리한다.
카드뉴스 전체 흐름을 기획한다.
각 장마다 한 가지 핵심만 전달하도록 내용을 나눈다.
내용의 성격에 맞게 디자인 콘셉트도 함께 잡는다.
텍스트가 잘 읽히고, 인스타그램에서 시선을 끌 수 있는 카드뉴스로 완성한다.

콘텐츠 구성 규칙:

첫 장은 표지로 제작한다.
중간 장들은 각각 하나의 핵심 내용만 담는다.
마지막 장은 핵심 정리, 느낀점, 또는 한 줄 인사이트로 마무리한다.
입력 내용이 길다면 그대로 다 넣지 말고, 핵심만 요약해 시각적으로 읽히게 구성한다.
문장은 짧고 강하게 정리한다.
숫자, 키워드, 인사이트는 강조 텍스트로 보여준다.
카드마다 정보량은 과하지 않게 조절한다.
글씨가 너무 작아지지 않도록 한다.
카드 전체 흐름은 "표지 -> 문제/배경 -> 해결/특징 -> 핵심 포인트 -> 결과/인사이트 -> 마무리" 구조를 기본으로 하되, 내용에 따라 유연하게 조정한다.

디자인 규칙:

인스타그램용 4:5 세로 비율 카드뉴스
한 장에 하나의 핵심 메시지
가독성을 최우선으로 한다
전체 카드가 하나의 시리즈처럼 통일감 있게 보이게 한다
하지만 주제에 따라 색감, 오브젝트, 분위기는 달라져야 한다
디자인은 입력된 내용의 분야와 감정에 맞게 자동으로 결정한다

오브젝트 사용 규칙:

오브젝트는 내용과 관련된 것만 사용한다
무조건 많이 넣지 말고 필요한 만큼만 넣는다
오브젝트가 가독성을 해치면 줄인다
텍스트보다 오브젝트가 더 튀지 않게 한다
장식은 과하지 않게, 메시지를 보조하는 수준으로만 사용한다

텍스트 처리 규칙:

모든 카드의 한국어 문장은 자연스럽고 오탈자 없이 작성한다
핵심 제목은 짧고 강하게
본문은 짧은 문장 또는 불릿 중심
중요한 단어는 굵게 보이거나 컬러 강조
카드 하단 또는 상단에는 필요 시 작게 카테고리 표기 가능
예: BOOK REVIEW / BRAND STORY / INSIGHT / CASE STUDY
페이지 번호를 작게 넣어도 좋다

출력 방식:

카드뉴스 여러 장을 하나의 시리즈로 제작한다
각 장은 한 장만 봐도 메시지가 이해되어야 한다
전체를 넘겨보면 자연스럽게 하나의 이야기처럼 이어져야 한다

추가 지시:

입력된 내용의 분야와 분위기를 먼저 해석하고, 거기에 맞는 디자인 스타일을 스스로 정해서 반영해라
특정 브랜드 사례라면 그 브랜드가 가진 시각적 분위기를 참고하되, 너무 복잡하지 않게 카드뉴스용으로 정리해라
카드뉴스는 예쁜 것보다 읽히는 것이 더 중요하다
과한 장식, 과도한 오브젝트, 너무 많은 텍스트는 피한다
필요한 경우 입력 내용을 더 매력적으로 보이게 짧은 보완 문구나 정리 문장을 추가해도 된다`;

function normalizeCardCount(cardCount = DEFAULT_CARD_COUNT) {
  const parsed = Number.parseInt(cardCount, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_CARD_COUNT;
  return Math.min(Math.max(parsed, MIN_CARD_COUNT), MAX_CARD_COUNT);
}

function line(label, value) {
  const text = String(value || '').trim();
  return text ? `${label}: ${text}` : '';
}

export function buildFreeformInputTextFromItem(item = {}) {
  return [
    line('원문 제목', item.source_title),
    line('원문 URL', item.source_url),
    line('초안 제목', item.draft_title),
    line('초안 본문', item.draft_body),
    line('원문 요약', item.raw_excerpt)
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildFreeformCardNewsPrompt({
  brand = {},
  item = {},
  inputText = '',
  cardCount = DEFAULT_CARD_COUNT
} = {}) {
  const normalizedCardCount = normalizeCardCount(cardCount);
  const sourceText = String(inputText || buildFreeformInputTextFromItem(item)).trim();

  if (!sourceText) {
    throw new Error('Freeform card news preview requires input text.');
  }

  return [
    CLIENT_CARD_NEWS_PROMPT.trim(),
    '',
    '[Brand_Pilot 실험 조건]',
    `총 ${normalizedCardCount}장의 인스타그램 4:5 세로 카드뉴스 이미지를 생성한다.`,
    '각 장은 하나의 개별 이미지여야 하며, 여러 장을 한 이미지에 콜라주처럼 합치지 않는다.',
    '이미지는 바로 업로드 가능한 완성 카드여야 하며, 텍스트도 이미지 안에 포함한다.',
    '설명문, 제작 과정, 마크다운 목록을 우선 출력하지 말고 이미지 생성 결과를 우선한다.',
    '',
    '[브랜드 참고]',
    line('브랜드명', brand.companyName),
    line('브랜드 톤', brand.brandVoice),
    line('서비스 요약', brand.serviceSummary),
    '',
    '[실제 입력 내용]',
    sourceText
  ]
    .filter((value) => value !== '')
    .join('\n');
}

