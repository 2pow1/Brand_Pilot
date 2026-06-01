# Brand Pilot

Advertising content automation MVP.

Brand Pilot은 클라이언트 자사의 홍보 콘텐츠 생성을 자동화하기 위한 2주 MVP 프로젝트입니다.

해외 브랜딩/마케팅 자료를 수집하고, GPT API로 공통 초안을 만든 뒤, Discord에서 클라이언트가 승인하거나 거절합니다. 승인된 초안은 다시 GPT API로 채널별 포맷에 맞춰 변환되며, MVP에서는 Instagram 카드뉴스 생성과 실제 게시까지를 우선 범위로 둡니다.

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
- 새로 만드는 함수와 메서드는 역할을 설명하는 JSDoc 스타일 문서 주석을 함께 작성합니다.

## 환경 변수

`.env.example`을 기준으로 로컬 `.env`를 생성합니다. 실제 API 키와 토큰은 GitHub에 커밋하지 않습니다. 운영 계정 전환 시 필요한 값 확인 위치와 GitHub Secrets/Variables 적용 기준은 `docs/env-setup.md`를 참고합니다. Meta Developer App과 Instagram 게시 token을 처음부터 발급해야 하면 `docs/meta-instagram-setup.md`를 참고합니다.

운영 환경의 상태 저장소는 Supabase Postgres를 기준으로 설계합니다. 로컬 CLI 검증은 `DATABASE_PROVIDER=sqlite`로 SQLite fallback을 사용하고, 무료 우선 운영은 GitHub Actions schedule이 `DATABASE_PROVIDER=supabase`로 CLI job을 실행합니다. 자세한 운영 DB 설계는 `docs/supabase-architecture.md`를 참고합니다.

설정 관련 문서:

- `docs/env-setup.md`: 전체 환경 변수, GitHub Actions Secrets/Variables, 운영 계정 전환 체크리스트
- `docs/meta-instagram-setup.md`: Facebook Page, Instagram Professional 계정, Meta App, long-lived token 발급
- `docs/discord-review.md`: Discord bot, 검수 채널, Supabase Edge Function, Interactions Endpoint URL
- `docs/notion-mirror.md`: Notion data source 속성, sync, artifact backup, Storage cleanup
- `docs/supabase-architecture.md`: Supabase Postgres/Storage/Edge Function 운영 구조

## 로컬 실행

현재 CLI 구현은 Node.js 24에서 SQLite 또는 Supabase provider로 실행할 수 있습니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js init
node --no-warnings=ExperimentalWarning src/cli.js status
node --no-warnings=ExperimentalWarning src/cli.js sample
node --no-warnings=ExperimentalWarning src/cli.js collect --dry-run --limit 2
node --no-warnings=ExperimentalWarning src/cli.js collect --limit 1
node --no-warnings=ExperimentalWarning src/cli.js draft --mock --limit 1
node --no-warnings=ExperimentalWarning src/cli.js draft --limit 1
node --no-warnings=ExperimentalWarning src/cli.js review check
node --no-warnings=ExperimentalWarning src/cli.js review request --mock --limit 1
node --no-warnings=ExperimentalWarning src/cli.js review approve <content-id>
node --no-warnings=ExperimentalWarning src/cli.js review reject <content-id>
node --no-warnings=ExperimentalWarning src/cli.js channel generate --limit 1
node --no-warnings=ExperimentalWarning src/cli.js instagram render --limit 1
node --no-warnings=ExperimentalWarning src/cli.js instagram upload --limit 1
node --no-warnings=ExperimentalWarning src/cli.js instagram publish --mock --limit 1
node --no-warnings=ExperimentalWarning src/cli.js instagram publish --limit 1
node --no-warnings=ExperimentalWarning src/cli.js notion check
node --no-warnings=ExperimentalWarning src/cli.js notion sync --limit 10
node --no-warnings=ExperimentalWarning src/cli.js notion backup --limit 10
node --no-warnings=ExperimentalWarning src/cli.js storage cleanup --limit 10
node --no-warnings=ExperimentalWarning src/cli.js storage cleanup --confirm --limit 10
node --no-warnings=ExperimentalWarning src/cli.js doctor schedule
node --no-warnings=ExperimentalWarning src/cli.js doctor discord
node --no-warnings=ExperimentalWarning src/cli.js doctor publish
node --no-warnings=ExperimentalWarning src/cli.js doctor notion
node --no-warnings=ExperimentalWarning --test
```

`collect --dry-run`은 DB 저장 없이 후보만 확인합니다. `collect`는 `config/sources.json`의 활성 소스를 읽고, 후보 콘텐츠를 `collected` 상태로 SQLite에 저장합니다. 이미 저장된 후보는 URL과 제목 기반 fingerprint로 중복 처리합니다.

`draft --mock`은 API 키 없이 검수용 초안 저장 흐름을 확인합니다. `draft`는 `.env`의 `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`을 사용해 OpenAI Responses API로 구조화된 초안을 생성하고, 성공한 항목을 `draft_created` 상태로 전환합니다.

`status`는 `progress.currentStep`, `activeSteps`, `nextCommands`를 함께 보여줍니다. 검수 대기 중인 콘텐츠가 있어도 다음 후보 수집과 초안 생성을 병렬로 진행할 수 있습니다.

`review check`는 Discord 메시지를 보내지 않고 봇 토큰과 검수 채널 접근 가능 여부만 확인합니다. `Missing Access`가 나오면 봇이 해당 채널을 볼 수 없다는 뜻이므로 봇 초대 여부, `DISCORD_REVIEW_CHANNEL_ID`, 채널의 `View Channel`/`Send Messages` 권한을 확인합니다. `review request --mock`은 Discord 토큰 없이 검수 요청 흐름을 확인합니다. 실제 Discord 전송은 `.env`의 `DISCORD_BOT_TOKEN`, `DISCORD_REVIEW_CHANNEL_ID`, `DISCORD_BASE_URL`을 사용합니다. 메시지에는 승인/거절 버튼용 `custom_id`가 포함되며, 인터랙션 수신 서버가 붙기 전까지는 `review approve <content-id>` 또는 `review reject <content-id>`로 수동 결정을 기록할 수 있습니다.

`channel generate`는 승인된 공통 초안을 다시 GPT API에 보내 채널별 payload로 변환합니다. 현재 활성 채널은 Instagram이며, GPT가 1080x1080 카드뉴스 5장 copy, caption, hashtags를 작성하고 렌더러가 필요한 구조로 `channel_outputs`에 저장합니다. API 없이 구조만 확인하려면 `channel generate --mock`을 사용합니다. `BRAND_CTA_ENABLED=true`이고 `BRAND_CTA_URL`이 있을 때만 CTA와 QR target URL을 포함합니다. 이미 생성 또는 게시 대기 중인 산출물을 새 브랜드 설정으로 다시 만들 때는 `channel regenerate <content-id>`를 실행한 뒤 `instagram render`, `instagram upload`, `instagram publish` 순서로 다시 진행합니다.

`instagram render`는 `channel_outputs`의 Instagram payload를 읽고 `artifacts/generated/instagram/<content-id>`에 1080x1080 PNG 5장과 `manifest.json`을 생성합니다. 렌더 결과물은 런타임 산출물이므로 Git에는 커밋하지 않습니다.

`instagram upload`는 렌더된 PNG와 manifest를 Supabase Storage public bucket에 업로드하고, `channel_outputs.artifact_path`를 공개 manifest URL로 바꿉니다.

`instagram publish --mock`은 Meta API 호출 없이 게시 상태 전이를 검증합니다. 실제 `instagram publish`는 `.env`의 `META_ACCESS_TOKEN`, `META_GRAPH_BASE_URL`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`를 사용해 Instagram Graph API로 게시합니다.

`notion check`는 Notion 토큰과 데이터소스 접근, 필수 속성 타입을 확인합니다. `notion sync`는 최근 콘텐츠 상태를 Notion 데이터소스에 생성/업데이트합니다. `notion backup`은 Supabase Storage의 공개 manifest와 PNG 카드뉴스를 Notion File Upload API로 가져와 Notion-hosted 파일로 붙입니다. Notion은 읽기용 미러이며 실제 상태 관리는 Supabase/SQLite 저장소가 담당합니다. 필요한 Notion 속성은 `docs/notion-mirror.md`에 정리되어 있습니다.

`storage cleanup`은 `published` 상태이고 Notion artifact backup이 `backed_up`으로 끝난 Instagram 산출물만 Supabase Storage에서 정리합니다. 기본 실행은 dry-run이라 삭제 후보와 object path만 보여주며, 실제 삭제는 `--confirm`을 붙였을 때만 수행합니다. 삭제가 성공하면 `channel_outputs.artifact_path`를 비워 중복 삭제를 막고 `content.storage.cleaned` 이벤트를 기록합니다.

`doctor schedule`은 GitHub Actions 정기 파이프라인에 필요한 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_REVIEW_CHANNEL_ID` 설정 여부를 비밀값 노출 없이 확인합니다. Notion은 선택 동기화이므로 `doctor notion`에서 별도로 확인합니다. `doctor discord`는 Discord 버튼 수신 Edge Function에 필요한 `DISCORD_PUBLIC_KEY`와 Supabase 설정을 함께 확인합니다. `doctor publish`는 Instagram 게시에 필요한 Meta/Supabase Storage 설정을 확인하고, `META_APP_ID`와 `META_APP_SECRET`이 있으면 Meta token debugger로 access token 유효성, 만료일, 필수 Instagram 권한, 대상 Instagram business account 접근 가능 여부까지 확인합니다. 만료 임박은 경고로만 표시하고, 만료/권한 누락/계정 접근 실패는 실패로 처리합니다.

`alert meta-token-expiry`는 `doctor publish`의 Meta token 만료 진단을 재사용해 만료 임박 또는 만료 상태일 때 Discord 검수 채널로 경고 메시지를 보냅니다. 매일 실행되는 `.github/workflows/brand-pilot-token-alert.yml`에서 사용합니다.

전체 구현 단계는 `docs/implementation-plan.md`에 정리되어 있습니다.

## 무료 우선 운영

`.github/workflows/brand-pilot-schedule.yml`은 6시간마다 GitHub Actions에서 수집, 초안 생성, Discord 검수 요청, Notion 미러를 실행합니다. `.github/workflows/brand-pilot-publish.yml`은 1시간마다 승인된 콘텐츠의 채널 payload 생성, Instagram 카드뉴스 렌더링, Supabase Storage 업로드, 실제 게시, Notion 미러/파일 백업, 백업 완료된 published 산출물의 Storage cleanup을 실행합니다. `.github/workflows/brand-pilot-token-alert.yml`은 매일 Meta token 만료 임박 여부를 확인해 Discord로 알립니다. 카드뉴스 렌더러가 Windows PowerShell과 `System.Drawing`을 사용하므로 publish workflow runner는 `windows-latest`를 사용합니다.

GitHub Secrets에는 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_REVIEW_CHANNEL_ID`를 등록합니다. 실제 Instagram 게시 필수 Secret은 `META_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`입니다. `META_APP_ID`, `META_APP_SECRET`은 token 만료일과 scope 진단을 위한 권장 Secret입니다. Notion 미러를 함께 쓰려면 `NOTION_TOKEN`, `NOTION_DATA_SOURCE_ID`도 추가합니다. GitHub Variables에는 필요하면 `OPENAI_MODEL`, `SUPABASE_STORAGE_BUCKET`, `META_TOKEN_EXPIRY_WARNING_DAYS`, `INSTAGRAM_PUBLISH_ENABLED`, `BRAND_COMPANY_NAME`, `BRAND_VOICE`, `BRAND_SERVICE_SUMMARY`, `BRAND_CTA_ENABLED`, `BRAND_CTA_LABEL`, `BRAND_CTA_URL`을 등록합니다. 실제 Instagram 게시 step은 publish workflow에서 `INSTAGRAM_PUBLISH_ENABLED=true`일 때만 실행되며, 기본값은 `false`입니다. `BRAND_COMPANY_NAME` 기본값은 `GrowthLine`이고, CTA URL이 없으면 오픈채팅 링크와 QR은 생성하지 않습니다. collection workflow는 먼저 `doctor schedule`을 실행해 필수 설정 누락을 명확히 보고한 뒤 수집/검수 요청을 실행합니다. Discord 승인/거절 버튼 수신은 `supabase/functions/discord-review` Edge Function을 배포해 처리합니다. 자세한 Discord 설정 순서는 `docs/discord-review.md`를 참고합니다.
