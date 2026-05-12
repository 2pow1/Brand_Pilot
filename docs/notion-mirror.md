# Notion Mirror

Notion은 Brand Pilot의 source of truth가 아니라 운영자가 보기 위한 기록 미러입니다. 실제 상태 전이와 자동화 기준은 Supabase의 `content_items`, `channel_outputs`, `events`입니다.

## Notion 데이터소스 속성

아래 속성을 가진 Notion 데이터소스를 만듭니다.

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

## 환경 변수

```text
NOTION_TOKEN=
NOTION_DATA_SOURCE_ID=
NOTION_VERSION=2026-03-11
```

기존 호환을 위해 `NOTION_DATABASE_ID`도 fallback으로 읽지만, 새 설정에서는 `NOTION_DATA_SOURCE_ID`를 사용합니다.

## 동기화

```powershell
node --no-warnings=ExperimentalWarning src/cli.js notion sync --limit 10
```

처음 동기화하면 Notion page를 만들고, 이후에는 Supabase `content_items.notion_page_id`를 기준으로 같은 page를 업데이트합니다.
