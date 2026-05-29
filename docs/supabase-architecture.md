# Supabase Architecture

Brand Pilot의 운영 기준 저장소는 Supabase Postgres입니다. SQLite는 로컬 개발과 빠른 기능 검증용 fallback으로만 사용합니다.

## Supabase를 쓰는 이유

- 24시간 켜둘 물리 PC 없이도 상태를 클라우드에 유지할 수 있습니다.
- GitHub Actions가 주기적으로 실행되어도 `content_items`, `channel_outputs`, `events` 상태가 사라지지 않습니다.
- Discord 버튼 이벤트처럼 즉시 받아야 하는 webhook은 Supabase Edge Function으로 처리할 수 있습니다.
- Notion은 보기와 백업용 미러로 두고, 실제 source of truth는 Supabase로 고정할 수 있습니다.
- 무료 우선 운영에서 별도 상시 서버 비용을 줄일 수 있습니다.

## 운영 구성

```text
GitHub Actions schedule
  -> Node CLI job
    -> Supabase Postgres
    -> Supabase Storage
    -> OpenAI API
    -> Discord API
    -> Instagram Graph API
    -> Notion API

Discord interaction
  -> Supabase Edge Function
    -> Supabase Postgres
```

현재 MVP 배포 방식은 무료 우선 구조를 기본값으로 둡니다.

- GitHub Actions schedule이 6시간마다 Node CLI job을 실행합니다.
- Supabase Postgres가 운영 상태 DB 역할을 합니다.
- Supabase Storage가 Instagram 게시용 public image URL을 제공합니다.
- Supabase Edge Function이 Discord 승인/거절 버튼 이벤트를 처리합니다.
- 별도 상시 서버나 worker는 게시 즉시성이 더 필요해질 때 분리합니다.

## 데이터 소유권

Supabase Postgres:

- 수집된 source 후보
- 공통 GPT 초안
- Discord 검수 상태
- 채널별 payload
- Instagram 게시 결과
- Notion sync/backup 상태
- 이벤트 로그

Supabase Storage:

- 렌더링된 Instagram PNG
- Instagram publish용 public manifest
- Instagram Graph API가 접근할 수 있는 public image URL

Notion:

- 운영자가 보기 위한 읽기용 기록 미러
- Supabase Storage 파일의 Notion-hosted 백업
- 사용자가 Notion 값을 직접 수정해도 자동화 상태에는 반영하지 않음

## 스키마 적용 순서

새 Supabase 프로젝트를 만들면 아래 순서로 SQL을 적용합니다.

1. `supabase/schema.sql`
2. `supabase/storage.sql`
3. `supabase/publish-lock.sql`
4. `supabase/notion-artifact-backup.sql`

이미 오래된 스키마가 적용된 프로젝트라면 필요한 보강 SQL만 추가 적용합니다.

- `supabase/notion.sql`: Notion mirror column 보강
- `supabase/publish-lock.sql`: 게시 중복 실행 방지용 lock/retry column 보강
- `supabase/notion-artifact-backup.sql`: Notion artifact backup column 보강

SQL Editor에는 파일 경로를 입력하는 것이 아니라 파일 내용을 복사해서 실행해야 합니다. Supabase SQL Editor는 로컬 PC의 `D:\workspace\...` 경로를 읽을 수 없습니다.

## 필요한 환경 변수

로컬 `.env`:

```text
DATABASE_PROVIDER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SCHEMA=public
SUPABASE_STORAGE_BUCKET=brand-pilot-instagram
```

GitHub Actions Secrets:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

GitHub Actions Variables:

```text
SUPABASE_STORAGE_BUCKET
```

Supabase Edge Function Secrets:

```text
DISCORD_PUBLIC_KEY
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 secret입니다. 브라우저 코드나 공개 저장소에 노출하면 안 됩니다.

## Storage 운영 기준

Instagram 실제 게시는 로컬 파일 경로를 받을 수 없고 public image URL이 필요합니다.

따라서 흐름은 아래처럼 나뉩니다.

```text
instagram render
  -> 로컬 PNG / manifest 생성
instagram upload
  -> Supabase Storage public bucket 업로드
  -> channel_outputs.artifact_path에 public manifest URL 기록
instagram publish
  -> manifest의 public image URL로 Instagram Graph API 게시
notion backup
  -> public file을 Notion-hosted file로 import
storage cleanup
  -> Notion backup 완료 후 Supabase Storage 파일 삭제
```

`storage cleanup`은 기본 dry-run이며, 실제 삭제는 `--confirm`이 있을 때만 수행합니다. DB row는 삭제하지 않고 `channel_outputs.artifact_path`만 비워 중복 삭제를 막습니다.

## 상태 전이 기준

```text
collected
-> draft_created
-> pending_review
-> approved / rejected
-> channel_generated
-> publish_pending
-> published / failed
```

`channel_outputs`는 채널별 작업 상태를 따로 저장합니다. 현재 MVP의 활성 채널은 `instagram`입니다.

## 검증 명령

```powershell
node --no-warnings=ExperimentalWarning src/cli.js status
node --no-warnings=ExperimentalWarning src/cli.js doctor schedule
node --no-warnings=ExperimentalWarning src/cli.js doctor discord
node --no-warnings=ExperimentalWarning src/cli.js doctor notion
node --no-warnings=ExperimentalWarning src/cli.js doctor publish
```

Supabase Storage 업로드와 정리는 아래 순서로 확인합니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js instagram upload --limit 1
node --no-warnings=ExperimentalWarning src/cli.js notion backup --limit 10
node --no-warnings=ExperimentalWarning src/cli.js storage cleanup --limit 10
```

실제 Storage 삭제는 dry-run 결과를 확인한 뒤에만 실행합니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js storage cleanup --confirm --limit 10
```
