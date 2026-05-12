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
- Supabase 기준 내부 상태 관리(SQLite 로컬 fallback)

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

## 개발 규칙

- 커밋 메시지 규칙은 `docs/commit-convention.md`를 따릅니다.

## 환경 변수

`.env.example`을 기준으로 로컬 `.env`를 생성합니다. 실제 API 키와 토큰은 GitHub에 커밋하지 않습니다.

운영 환경의 상태 저장소는 Supabase Postgres를 기준으로 설계합니다. 로컬 CLI 검증은 `DATABASE_PROVIDER=sqlite`로 SQLite fallback을 사용하고, 운영 전환 시에는 `supabase/schema.sql`을 적용한 뒤 Supabase adapter를 붙입니다. 자세한 운영 DB 설계는 `docs/supabase-architecture.md`를 참고합니다.

## 로컬 실행

현재 CLI 구현은 Node.js 24의 내장 SQLite adapter를 사용합니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js init
node --no-warnings=ExperimentalWarning src/cli.js status
node --no-warnings=ExperimentalWarning src/cli.js sample
node --no-warnings=ExperimentalWarning src/cli.js collect --dry-run --limit 2
node --no-warnings=ExperimentalWarning src/cli.js collect --limit 1
node --no-warnings=ExperimentalWarning src/cli.js draft --mock --limit 1
node --no-warnings=ExperimentalWarning src/cli.js draft --limit 1
node --no-warnings=ExperimentalWarning src/cli.js review request --mock --limit 1
node --no-warnings=ExperimentalWarning src/cli.js review approve <content-id>
node --no-warnings=ExperimentalWarning src/cli.js review reject <content-id>
node --no-warnings=ExperimentalWarning src/cli.js channel generate --limit 1
node --no-warnings=ExperimentalWarning src/cli.js instagram render --limit 1
node --no-warnings=ExperimentalWarning --test
```

`collect --dry-run`은 DB 저장 없이 후보만 확인합니다. `collect`는 `config/sources.json`의 활성 소스를 읽고, 후보 콘텐츠를 `collected` 상태로 SQLite에 저장합니다. 이미 저장된 후보는 URL과 제목 기반 fingerprint로 중복 처리합니다.

`draft --mock`은 API 키 없이 검수용 초안 저장 흐름을 확인합니다. `draft`는 `.env`의 `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`을 사용해 OpenAI Responses API로 구조화된 초안을 생성하고, 성공한 항목을 `draft_created` 상태로 전환합니다.

`status`는 `progress.currentStep`, `activeSteps`, `nextCommands`를 함께 보여줍니다. 검수 대기 중인 콘텐츠가 있어도 다음 후보 수집과 초안 생성을 병렬로 진행할 수 있습니다.

`review request --mock`은 Discord 토큰 없이 검수 요청 흐름을 확인합니다. 실제 Discord 전송은 `.env`의 `DISCORD_BOT_TOKEN`, `DISCORD_REVIEW_CHANNEL_ID`, `DISCORD_BASE_URL`을 사용합니다. 메시지에는 승인/거절 버튼용 `custom_id`가 포함되며, 인터랙션 수신 서버가 붙기 전까지는 `review approve <content-id>` 또는 `review reject <content-id>`로 수동 결정을 기록할 수 있습니다.

`channel generate`는 승인된 공통 초안을 채널별 payload로 변환합니다. 현재 활성 채널은 Instagram이며, 1080x1080 카드뉴스 5장 구조, caption, hashtags, CTA, QR target URL을 `channel_outputs`에 저장합니다.

`instagram render`는 `channel_outputs`의 Instagram payload를 읽고 `artifacts/generated/instagram/<content-id>`에 1080x1080 PNG 5장과 `manifest.json`을 생성합니다. 렌더 결과물은 런타임 산출물이므로 Git에는 커밋하지 않습니다.

전체 구현 단계는 `docs/implementation-plan.md`에 정리되어 있습니다.
