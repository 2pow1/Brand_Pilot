# Supabase Architecture

Brand Pilot의 운영 기준 DB는 Supabase Postgres입니다. SQLite는 로컬 개발과 빠른 기능 검증용 fallback으로만 사용합니다.

## 왜 Supabase인가

- 24시간 켜둘 물리 PC가 없어도 상태가 클라우드에 남습니다.
- 자동화 작업이 재시작되어도 `content_items`, `channel_outputs`, `events` 상태를 잃지 않습니다.
- GitHub Actions schedule과 Supabase Edge Functions 조합으로 서버 비용 없이 주기 실행과 webhook 수신을 처리할 수 있습니다.
- 상태 페이지나 운영 대시보드를 나중에 붙이기 쉽습니다.
- Notion은 여전히 기록 확인용 미러로 유지하고, source of truth는 Supabase로 둡니다.

## 운영 구성

```text
GitHub Actions schedule
  -> Node CLI job
    -> Supabase Postgres
    -> OpenAI API
    -> Discord API
    -> Instagram Graph API
    -> Notion API

Discord interaction
  -> Supabase Edge Function
    -> Supabase Postgres
```

MVP 배포 방식은 무료 우선 구조를 기본값으로 둡니다.

- GitHub Actions schedule이 6시간마다 Node CLI job을 실행
- Supabase Free가 상태 DB와 Discord webhook용 Edge Function을 담당
- 별도 상시 서버/worker는 운영 한계가 보일 때만 추가

## 데이터 소유권

Supabase:
- 콘텐츠 상태
- 원문 후보
- 공통 초안
- 검수 상태
- 채널별 payload
- 게시 결과
- 이벤트 로그

파일 스토리지:
- 렌더링된 Instagram PNG
- manifest
- Instagram Graph API가 접근할 수 있는 공개 이미지 URL

Notion:
- 사람이 보기 위한 기록 미러
- 운영자가 직접 수정해도 자동화 상태에는 반영하지 않음

## 마이그레이션 순서

1. `supabase/schema.sql`을 Supabase SQL Editor에서 적용합니다.
2. `.env`에 Supabase 값을 추가합니다.
3. GitHub Secrets에 Supabase/OpenAI/Discord 값을 등록합니다.
4. GitHub Actions schedule을 활성화합니다.
5. Discord Developer Portal의 Interactions Endpoint URL을 Supabase Edge Function URL로 설정합니다.
6. 기존 SQLite 테스트는 local fallback으로 유지합니다.

## 필요한 환경 변수

```text
DATABASE_PROVIDER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SCHEMA=public
SUPABASE_STORAGE_BUCKET=brand-pilot-instagram
DISCORD_PUBLIC_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 secret입니다. 브라우저나 클라이언트 앱에 노출하면 안 됩니다.

GitHub Actions Secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `OPENAI_API_KEY`
- `DISCORD_BOT_TOKEN`
- `DISCORD_REVIEW_CHANNEL_ID`
- `NOTION_TOKEN`
- `NOTION_DATA_SOURCE_ID`
- `NOTION_VERSION`
- `META_ACCESS_TOKEN`
- `META_GRAPH_BASE_URL`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`

Supabase Edge Function Secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DISCORD_PUBLIC_KEY`

## 참고

- GitHub Actions schedule은 별도 서버 없이 주기 job을 실행할 수 있습니다.
- Supabase Edge Functions는 Discord interaction처럼 즉시 받아야 하는 webhook에 적합합니다.
- Instagram 실제 게시는 로컬 파일 경로가 아니라 공개 이미지 URL을 요구하므로 `instagram upload`가 Supabase Storage public URL을 만든 뒤 `instagram publish`가 실행됩니다.
