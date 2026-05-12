# Supabase Architecture

Brand Pilot의 운영 기준 DB는 Supabase Postgres입니다. SQLite는 로컬 개발과 빠른 기능 검증용 fallback으로만 사용합니다.

## 왜 Supabase인가

- 24시간 켜둘 물리 PC가 없어도 상태가 클라우드에 남습니다.
- 자동화 작업이 재시작되어도 `content_items`, `channel_outputs`, `events` 상태를 잃지 않습니다.
- Supabase Cron과 Edge Functions 조합으로 주기 실행을 클라우드에서 처리할 수 있습니다.
- 상태 페이지나 운영 대시보드를 나중에 붙이기 쉽습니다.
- Notion은 여전히 기록 확인용 미러로 유지하고, source of truth는 Supabase로 둡니다.

## 운영 구성

```text
Scheduler
  -> App job endpoint / worker
    -> Supabase Postgres
    -> OpenAI API
    -> Discord API
    -> Instagram Graph API
    -> Notion API
```

MVP 배포 방식은 두 가지 중 하나로 갈 수 있습니다.

- 웹 서버/worker를 하나 배포하고 Supabase Cron이 HTTP로 호출
- 별도 cron 지원 PaaS에서 Node job을 주기 실행하고 Supabase를 DB로 사용

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

Notion:
- 사람이 보기 위한 기록 미러
- 운영자가 직접 수정해도 자동화 상태에는 반영하지 않음

## 마이그레이션 순서

1. `supabase/schema.sql`을 Supabase SQL Editor에서 적용합니다.
2. `.env`에 Supabase 값을 추가합니다.
3. DB adapter를 Supabase provider로 전환합니다.
4. 기존 SQLite 테스트는 local fallback으로 유지합니다.
5. 스케줄러는 Supabase Cron 또는 배포 플랫폼 cron 중 하나로 연결합니다.

## 필요한 환경 변수

```text
DATABASE_PROVIDER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SCHEMA=public
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 secret입니다. 브라우저나 클라이언트 앱에 노출하면 안 됩니다.

## 참고

- Supabase Cron은 Postgres 안에서 cron job을 관리하고, SQL 또는 HTTP 호출을 주기 실행할 수 있습니다.
- Supabase Edge Functions는 Cron과 함께 주기적으로 호출할 수 있습니다.
