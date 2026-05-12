# Brand Pilot

Advertising content automation MVP.

Brand Pilot은 클라이언트 자사의 홍보 콘텐츠 생성을 자동화하기 위한 2주 MVP 프로젝트입니다.

해외 브랜딩/마케팅 자료를 수집하고, GPT API로 공통 초안을 만든 뒤, Discord에서 클라이언트가 승인하거나 거절합니다. 승인된 초안은 채널별 템플릿에 맞춰 변환되며, MVP에서는 Instagram 카드뉴스 생성과 실제 게시까지를 우선 범위로 둡니다.

## MVP 범위

- 지정된 자료 소스 수집
- GPT API 기반 공통 홍보 초안 생성
- Discord 승인/거절 검수
- 승인 시 Instagram 카드뉴스 콘텐츠 생성
- Instagram 게시
- Notion 기록 미러
- SQLite 기반 내부 상태 관리

## 주요 전제

- 이 서비스는 클라이언트가 타사를 브랜딩해주는 사업을 홍보하기 위해, 클라이언트 자사의 콘텐츠 생성과 게시 과정을 자동화합니다.
- Notion은 읽기/기록 확인용 미러이며, 실제 상태 관리는 애플리케이션 내부 저장소에서 처리합니다.
- 승인 대기 중인 콘텐츠가 있어도 다음 후보 수집과 초안 생성은 계속 진행할 수 있습니다.
- Instagram 실제 게시는 Professional 계정과 Meta API 연결이 필요합니다.

## 흐름도

현재 기준 흐름도는 `artifacts/flows/final`에 있습니다.

- `brand-pilot-client-user-flow-v2.png`: 클라이언트 사용 흐름도
- `brand-pilot-program-flow-v2.png`: 프로그램 동작 순서도

자세한 정리는 `artifacts/flows/README.md`를 참고합니다.

## 환경 변수

`.env.example`을 기준으로 로컬 `.env`를 생성합니다. 실제 API 키와 토큰은 GitHub에 커밋하지 않습니다.
