# Notion Mirror

Notion은 Brand Pilot의 source of truth가 아니라 운영자가 보기 위한 읽기용 기록 미러입니다. 실제 상태 전이와 자동화 기준은 Supabase의 `content_items`, `channel_outputs`, `events`입니다.

## Data Source

Notion에서 database를 만들고 아래 속성을 추가합니다. Notion API `2026-03-11` 기준으로는 page를 database 아래에 만들 때 database id가 아니라 data source id를 사용합니다.

| Property | Type |
|---|---|
| Name | Title |
| Content ID | Text |
| Status | Text |
| Source | Text |
| Source URL | URL |
| Draft | Text |
| Review Message | Text |
| Rejection Reason | Text |
| Channel | Text |
| Channel Status | Text |
| Caption | Text |
| Hashtags | Text |
| Slide Count | Number |
| Artifact URL | URL |
| Published URL | URL |
| Channel Last Error | Text |
| Backup Status | Text |
| Backup Completed At | Date |
| Backup File Count | Number |
| Backup Last Error | Text |
| Artifact Files | Files & media |
| Updated At | Date |

`Artifact URL`은 Supabase Storage의 공개 manifest URL입니다. `Artifact Files`는 `notion backup`이 Notion File Upload API로 import한 manifest와 PNG 카드뉴스 파일입니다. Supabase Storage를 나중에 정리하려면 `Backup Status=backed_up`이고 `Artifact Files`에 파일이 붙은 항목만 정리 대상으로 삼아야 합니다.

## Connection

1. Notion에서 integration을 만들고 internal integration token을 발급합니다.
2. Brand Pilot database 또는 data source가 있는 Notion page에서 해당 integration을 초대합니다.
3. database 메뉴의 data source 관리 화면에서 data source id를 복사합니다.

`.env`에는 아래 값을 추가합니다.

```text
NOTION_TOKEN=
NOTION_DATA_SOURCE_ID=
NOTION_VERSION=2026-03-11
```

기존 호환을 위해 `NOTION_DATABASE_ID`도 fallback으로 읽지만, 새 설정에서는 `NOTION_DATA_SOURCE_ID`를 사용합니다.

## Check

먼저 로컬에서 값 존재 여부를 확인합니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js doctor notion
```

그 다음 Notion API로 실제 data source 접근 권한과 속성 타입을 확인합니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js notion check
```

`ok: true`이면 동기화와 파일 백업을 실행할 준비가 된 상태입니다. `missing`에 속성이 나오면 Notion data source의 속성 이름 또는 타입을 표와 맞춥니다.

## Sync

```powershell
node --no-warnings=ExperimentalWarning src/cli.js notion sync --limit 10
```

처음 동기화하면 Notion page를 만들고, 이후에는 Supabase `content_items.notion_page_id`를 기준으로 같은 page를 업데이트합니다. Notion sync는 `content_items` 기본 정보와 Instagram `channel_outputs`의 caption, hashtag, slide count, artifact URL, published URL, channel status를 함께 미러링합니다.

## Artifact Backup

```powershell
node --no-warnings=ExperimentalWarning src/cli.js notion backup --limit 10
```

`notion backup`은 다음 조건을 만족하는 Instagram channel output만 처리합니다.

- `notion sync`가 먼저 실행되어 `notion_page_id`가 있어야 합니다.
- `artifact_path`가 Supabase Storage public manifest URL이어야 합니다.
- channel output의 `backup_status`가 `backed_up`이 아니어야 합니다.

백업 과정:

1. Supabase Storage의 public manifest를 읽습니다.
2. manifest와 각 PNG slide URL을 Notion File Upload API의 `external_url` 모드로 import합니다.
3. Notion page의 `Artifact Files` 속성에 Notion-hosted file로 붙입니다.
4. `channel_outputs.backup_status`, `backup_completed_at`, `backup_payload_json`을 갱신합니다.

이 단계가 성공한 뒤에야 해당 카드뉴스 파일은 Supabase Storage 정리 후보가 됩니다.

## Storage Cleanup

```powershell
node --no-warnings=ExperimentalWarning src/cli.js storage cleanup --limit 10
node --no-warnings=ExperimentalWarning src/cli.js storage cleanup --confirm --limit 10
```

`storage cleanup`은 Supabase Storage 용량 확보용 유지보수 명령입니다. 기본 실행은 dry-run이며, 실제 삭제는 `--confirm`이 있을 때만 수행합니다.

정리 대상 조건:

- content item 상태가 `published`여야 합니다.
- Instagram channel output 상태가 `published`여야 합니다.
- channel output의 `backup_status`가 `backed_up`이어야 합니다.
- `artifact_path`가 Supabase Storage public manifest URL이어야 합니다.

정리 과정:

1. Supabase DB에서 조건을 만족하는 channel output을 조회합니다.
2. public manifest를 읽어 manifest와 slide PNG object path를 계산합니다.
3. dry-run이면 삭제 후보만 출력합니다.
4. `--confirm`이면 Supabase Storage API로 해당 object들을 삭제합니다.
5. 삭제가 성공하면 `channel_outputs.artifact_path`를 빈 값으로 바꾸고 `content.storage.cleaned` 이벤트를 기록합니다.

DB row는 삭제하지 않습니다. 이 명령은 Storage 파일만 정리하며, Notion에는 이미 import된 파일이 남아 있어야 합니다.

## GitHub Actions

GitHub Actions에서는 `NOTION_TOKEN`과 `NOTION_DATA_SOURCE_ID`가 둘 다 있을 때만 Notion sync와 artifact backup step을 실행합니다. 값이 없으면 schedule pipeline은 Notion 단계만 건너뛰고 계속 성공할 수 있습니다.
