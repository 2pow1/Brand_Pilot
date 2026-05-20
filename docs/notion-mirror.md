# Notion Mirror

Notion은 Brand Pilot의 source of truth가 아니라 운영자가 보기 위한 읽기용 기록 미러입니다. 실제 상태 전이와 자동화 기준은 Supabase의 `content_items`, `channel_outputs`, `events`입니다.

## Data Source

Notion에 새 database를 만들고 아래 속성을 추가합니다. Notion API `2026-03-11`에서는 page를 database 아래에 만들 때 database id가 아니라 data source id를 사용합니다.

| Property | Type |
|----------|------|
| Name | Title |
| Content ID | Text |
| Status | Text |
| Source | Text |
| Source URL | URL |
| Draft | Text |
| Review Message | Text |
| Rejection Reason | Text |
| Updated At | Date |

## Connection

1. Notion에서 integration을 만들고 internal integration token을 발급합니다.
2. 위 database 또는 data source가 있는 Notion page에서 해당 integration을 초대합니다.
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

`ok: true`이면 동기화 준비가 끝난 상태입니다. `missing`에 속성이 나오면 Notion data source의 속성 이름 또는 타입을 위 표와 맞춥니다.

## Sync

```powershell
node --no-warnings=ExperimentalWarning src/cli.js notion sync --limit 10
```

처음 동기화하면 Notion page를 만들고, 이후에는 Supabase `content_items.notion_page_id`를 기준으로 같은 page를 업데이트합니다.

GitHub Actions에서는 `NOTION_TOKEN`과 `NOTION_DATA_SOURCE_ID`가 둘 다 있을 때만 Notion sync step을 실행합니다. 값이 없으면 schedule pipeline은 Notion만 건너뛰고 계속 성공할 수 있습니다.
