# Environment Setup

이 문서는 운영 계정 전환 시 필요한 환경 변수, 확인 위치, GitHub Actions 적용 기준을 정리합니다. 실제 토큰, API key, secret 값은 문서나 Git에 기록하지 않습니다.

## 전체 설정 순서

새 운영 계정으로 처음 세팅할 때는 아래 순서로 진행합니다.

1. Supabase 프로젝트를 만들고 SQL schema와 Storage bucket을 준비합니다.
2. OpenAI API key를 발급합니다.
3. Discord 앱과 bot을 만들고 검수 채널에 초대합니다.
4. Supabase Edge Function `discord-review`를 배포하고 Discord Interactions Endpoint URL을 연결합니다.
5. Notion integration과 data source를 만들고 integration을 초대합니다.
6. Instagram 계정을 Professional 계정으로 전환합니다.
7. Facebook Page를 만들고 Instagram Professional 계정을 해당 Page에 연결합니다.
8. Meta Developer App을 만들고 Graph API Explorer에서 Instagram 게시용 token과 IG User ID를 확인합니다.
9. 로컬 `.env`에 값을 넣고 `doctor *` 명령으로 진단합니다.
10. GitHub Actions Secrets/Variables에 운영 값을 넣고 `workflow_dispatch`로 수동 실행합니다.

각 서비스별 상세 절차는 아래 문서로 분리되어 있습니다.

- Discord: `docs/discord-review.md`
- Meta / Facebook / Instagram: `docs/meta-instagram-setup.md`
- Notion: `docs/notion-mirror.md`
- Supabase 운영 구조: `docs/supabase-architecture.md`

## 적용 위치

로컬 실행:

```text
D:\workspace\Brand_Pilot\.env
```

GitHub Actions:

```text
GitHub repository
-> Settings
-> Secrets and variables
-> Actions
```

구분 기준:

- `Secrets`: API key, access token, service role key처럼 노출되면 안 되는 값
- `Variables`: 모델명, bucket 이름, 기능 플래그처럼 민감하지 않은 값
- workflow 고정값: 코드에서 직접 관리해도 되는 기본 URL이나 schema 값

## 값 요약

| 이름 | 로컬 `.env` | GitHub Actions | 용도 |
|---|---|---|---|
| `DATABASE_PROVIDER` | 필요 | workflow 고정값 | 운영에서는 `supabase` |
| `DATABASE_URL` | SQLite 사용 시 필요 | 불필요 | 로컬 SQLite fallback 경로 |
| `SUPABASE_URL` | 필요 | Secret | Supabase REST/Storage API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 필요 | Secret | 서버 작업용 Supabase key |
| `SUPABASE_SCHEMA` | 선택 | workflow 고정값 | 기본값 `public` |
| `SUPABASE_STORAGE_BUCKET` | 필요 | Variable | Instagram 이미지 업로드 bucket |
| `OPENAI_API_KEY` | 필요 | Secret | GPT 공통 초안 생성 및 승인 후 채널별 콘텐츠 변환 |
| `OPENAI_MODEL` | 선택 | Variable | 기본값 `gpt-4.1-mini` |
| `OPENAI_BASE_URL` | 선택 | workflow 고정값 | 기본값 `https://api.openai.com/v1` |
| `DISCORD_BOT_TOKEN` | 필요 | Secret | 검수 메시지 전송 |
| `DISCORD_REVIEW_CHANNEL_ID` | 필요 | Secret | 검수 채널 ID |
| `DISCORD_PUBLIC_KEY` | Edge Function 배포 시 필요 | Supabase secret | Discord interaction 서명 검증 |
| `DISCORD_BASE_URL` | 선택 | workflow 고정값 | 기본값 `https://discord.com/api/v10` |
| `NOTION_TOKEN` | 선택 | Secret | Notion mirror sync |
| `NOTION_DATA_SOURCE_ID` | 선택 | Secret | Notion 대상 data source |
| `NOTION_BASE_URL` | 선택 | workflow 고정값 | 기본값 `https://api.notion.com/v1` |
| `NOTION_VERSION` | 선택 | workflow 고정값 | 기본값 `2026-03-11` |
| `META_ACCESS_TOKEN` | Instagram 게시 필수 | Secret | Instagram Graph API 게시 |
| `META_APP_ID` | 진단 권장 | Secret | Meta token debugger |
| `META_APP_SECRET` | 진단 권장 | Secret | Meta token debugger |
| `META_TOKEN_EXPIRY_WARNING_DAYS` | 선택 | Variable | 토큰 만료 경고 기준일 |
| `META_GRAPH_BASE_URL` | 선택 | workflow 고정값 | 기본값 `https://graph.facebook.com/v25.0` |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Instagram 게시 필수 | Secret | 게시 대상 Instagram business account |
| `INSTAGRAM_PUBLISH_ENABLED` | workflow 전용 | Variable | `true`일 때만 Actions에서 실제 Instagram 게시 실행 |
| `BRAND_COMPANY_NAME` | 선택 | Variable | 게시물에 노출할 회사명, 기본값 `GrowthLine` |
| `BRAND_VOICE` | 선택 | Variable | 초안 생성용 브랜드 말투 |
| `BRAND_SERVICE_SUMMARY` | 선택 | Variable | 초안 생성용 서비스 설명 |
| `BRAND_CTA_ENABLED` | 선택 | Variable | `true`일 때만 CTA/QR 사용 |
| `BRAND_CTA_LABEL` | 선택 | Variable | CTA 문구 |
| `BRAND_CTA_URL` | 선택 | Variable | CTA/QR target URL |

## Supabase

확인 위치:

```text
Supabase project
-> Project Settings
-> API
```

로컬 `.env` 값:

```env
DATABASE_PROVIDER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SCHEMA=public
SUPABASE_STORAGE_BUCKET=brand-pilot-instagram
```

확인 사항:

- `SUPABASE_URL`은 project URL입니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 service role key입니다. anon key를 쓰면 서버 쓰기 작업이 실패할 수 있습니다.
- 새 Supabase 프로젝트로 전환할 때는 `supabase/schema.sql`과 필요한 보강 SQL을 SQL Editor에서 적용합니다.
- Instagram Storage bucket 이름은 `.env`, GitHub Variable, Supabase bucket 이름이 동일해야 합니다.
- 현재 Instagram 업로드는 public URL을 사용하므로 bucket public 접근 정책을 확인합니다.

검증 명령:

```powershell
node --no-warnings=ExperimentalWarning src/cli.js status
```

## Brand Identity

브랜드 기본값은 `config/brand.example.json`에 있고, 운영 환경에서는 env 또는 GitHub Actions Variables로 덮어쓸 수 있습니다.

현재 기본 회사명은 `GrowthLine`입니다.

로컬 `.env` 값:

```env
BRAND_COMPANY_NAME=GrowthLine
BRAND_VOICE=clear, practical, founder-friendly
BRAND_SERVICE_SUMMARY=Branding and marketing support for small businesses.
BRAND_CTA_ENABLED=false
BRAND_CTA_LABEL=
BRAND_CTA_URL=
```

운영 기준:

- `BRAND_COMPANY_NAME`은 초안 프롬프트, 카드뉴스 상단 브랜드명, 최종 슬라이드에 사용됩니다.
- `BRAND_CTA_ENABLED=false`이거나 `BRAND_CTA_URL`이 비어 있으면 오픈채팅 링크, 샘플 URL, QR placeholder를 노출하지 않습니다.
- 나중에 오픈채팅방이 준비되면 `BRAND_CTA_ENABLED=true`, `BRAND_CTA_LABEL`, `BRAND_CTA_URL`을 설정합니다.

## OpenAI

확인 위치:

```text
OpenAI Platform
-> API keys
```

로컬 `.env` 값:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

운영에서는 비용과 품질 기준에 맞춰 `OPENAI_MODEL`을 조정합니다. 모델명을 바꾼 뒤에는 낮은 limit으로 공통 초안 생성과 승인 후 채널별 변환을 각각 검증합니다.

검증 명령:

```powershell
node --no-warnings=ExperimentalWarning src/cli.js draft --limit 1
node --no-warnings=ExperimentalWarning src/cli.js channel generate --limit 1
```

## Discord

확인 위치:

```text
Discord Developer Portal
-> Applications
-> 대상 앱
```

로컬 `.env` 값:

```env
DISCORD_BOT_TOKEN=
DISCORD_REVIEW_CHANNEL_ID=
DISCORD_BASE_URL=https://discord.com/api/v10
DISCORD_PUBLIC_KEY=
```

`DISCORD_REVIEW_CHANNEL_ID` 확인:

```text
Discord
-> User Settings
-> Advanced
-> Developer Mode 활성화
-> 검수 채널 우클릭
-> Copy Channel ID
```

`DISCORD_PUBLIC_KEY` 확인:

```text
Discord Developer Portal
-> Applications
-> 대상 앱
-> General Information
-> Public Key
```

검증 명령:

```powershell
node --no-warnings=ExperimentalWarning src/cli.js doctor discord
node --no-warnings=ExperimentalWarning src/cli.js review check
```

Edge Function secret 적용 및 배포:

```powershell
npx supabase secrets set DISCORD_PUBLIC_KEY=<discord-application-public-key> --project-ref <project-ref>
npx supabase functions deploy discord-review --no-verify-jwt --project-ref <project-ref> --use-api
```

Discord Interactions Endpoint URL:

```text
https://<project-ref>.supabase.co/functions/v1/discord-review
```

## Notion

확인 위치:

```text
Notion
-> Settings
-> Connections
-> Internal integration
```

로컬 `.env` 값:

```env
NOTION_TOKEN=
NOTION_DATA_SOURCE_ID=
NOTION_VERSION=2026-03-11
```

설정 순서:

1. Notion integration token을 발급합니다.
2. Brand Pilot용 database/data source page를 엽니다.
3. 우측 상단 `...` 또는 `Share`에서 integration을 초대합니다.
4. data source ID를 확인해 `NOTION_DATA_SOURCE_ID`에 넣습니다.

검증 명령:

```powershell
node --no-warnings=ExperimentalWarning src/cli.js doctor notion
node --no-warnings=ExperimentalWarning src/cli.js notion check
node --no-warnings=ExperimentalWarning src/cli.js notion sync --limit 10
node --no-warnings=ExperimentalWarning src/cli.js notion backup --limit 10
node --no-warnings=ExperimentalWarning src/cli.js storage cleanup --limit 10
```

주의:

- Notion은 source of truth가 아니라 읽기용 미러입니다.
- 실제 상태 전이는 Supabase 또는 SQLite 저장소가 담당합니다.
- GitHub Actions에서는 `NOTION_TOKEN`과 `NOTION_DATA_SOURCE_ID`가 둘 다 있을 때만 Notion sync/backup step을 실행합니다.
- `notion backup`은 Supabase Storage public manifest와 PNG를 Notion File Upload API로 가져와 `Artifact Files`에 붙입니다.
- `storage cleanup`은 Notion backup이 완료된 `published` Instagram 산출물만 Supabase Storage에서 정리합니다. 기본값은 dry-run이고 실제 삭제는 `--confirm`이 필요합니다.
- 필요한 Notion 속성은 `docs/notion-mirror.md`를 기준으로 맞춥니다.

## Meta / Instagram

현재 Meta 인증이 막혀 있으면 이 섹션은 보류합니다. Instagram 실제 게시 전까지는 `instagram publish --mock` 또는 render/upload까지만 검증합니다.

Meta Developer App이 아직 없거나 token을 처음부터 다시 발급해야 하면 `docs/meta-instagram-setup.md`의 순서를 먼저 따릅니다.

필수 사전 조건:

- Instagram 계정이 Professional 계정이어야 합니다.
- Facebook Page가 있어야 합니다.
- Instagram Professional 계정이 해당 Facebook Page와 연결되어 있어야 합니다.
- Meta Developer App에서 token을 발급하는 Facebook 계정이 해당 Page와 Instagram 계정에 접근할 수 있어야 합니다.

확인 위치:

```text
Meta Developers
-> My Apps
-> 대상 앱
-> App settings
-> Basic
```

로컬 `.env` 값:

게시 필수값:

```env
META_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
```

진단 권장값:

```env
META_APP_ID=
META_APP_SECRET=
```

운영 옵션값:

```env
META_TOKEN_EXPIRY_WARNING_DAYS=7
META_GRAPH_BASE_URL=https://graph.facebook.com/v25.0
```

`META_APP_ID`, `META_APP_SECRET` 확인:

```text
Meta Developers
-> 대상 앱
-> App settings
-> Basic
-> App ID / App secret
```

`META_ACCESS_TOKEN`:

- Graph API Explorer에서 받은 단기 user access token을 그대로 운영값으로 쓰지 않습니다.
- 운영 테스트에서는 단기 token을 long-lived user access token으로 교환한 값을 사용합니다.
- token debugger에서 만료일과 scope를 확인합니다.
- 필요한 최소 scope는 `instagram_basic`, `instagram_content_publish`입니다.
- token 발급과 long-lived token 교환 절차는 `docs/meta-instagram-setup.md`의 `6. 단기 토큰을 Long-Lived User Token으로 교환`에 정리되어 있습니다.

`META_APP_ID`, `META_APP_SECRET`은 게시 자체에는 필수가 아니지만 `doctor publish`가 token debugger로 만료일과 scope를 확인할 때 필요합니다.

`INSTAGRAM_BUSINESS_ACCOUNT_ID`:

Graph API Explorer에서 다음 요청으로 확인합니다.

```text
GET /me/accounts?fields=id,name,instagram_business_account{id,username}
```

응답의 `instagram_business_account.id`가 `INSTAGRAM_BUSINESS_ACCOUNT_ID`입니다. Facebook Page ID와 혼동하지 않습니다.

검증 명령:

```powershell
node --no-warnings=ExperimentalWarning src/cli.js doctor publish
node --no-warnings=ExperimentalWarning src/cli.js alert meta-token-expiry
```

정상 예:

```text
[ok] META_ACCESS_TOKEN
[ok] INSTAGRAM_BUSINESS_ACCOUNT_ID
[ok] SUPABASE_STORAGE_BUCKET
[ok] META_ACCESS_TOKEN_VALID
[ok] META_ACCESS_TOKEN_EXPIRY
[ok] META_ACCESS_TOKEN_SCOPES
[ok] INSTAGRAM_BUSINESS_ACCOUNT_ACCESS
```

만료 임박은 `[warn]`으로 표시되며 실패로 처리하지 않습니다. `INSTAGRAM_PAGE_CONNECTION`도 Instagram-login token에서는 `[warn]`일 수 있습니다. 이 경우 `INSTAGRAM_BUSINESS_ACCOUNT_ACCESS`가 `[ok]`이면 게시 접근성 판단은 통과입니다. 만료, 권한 누락, Instagram account 접근 실패는 실패입니다.

## GitHub Actions 설정

GitHub Actions 값은 repository의 아래 위치에서 관리합니다.

```text
GitHub repository
-> Settings
-> Secrets and variables
-> Actions
```

### 최소 실행 필수 Secrets

`doctor schedule`이 통과하고 수집/초안/Discord 검수 요청까지 실행되기 위한 최소값입니다.

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
DISCORD_BOT_TOKEN
DISCORD_REVIEW_CHANNEL_ID
```

### Notion 사용 시 추가 Secrets

Notion mirror와 artifact backup을 실행하려면 추가합니다. 둘 중 하나라도 비어 있으면 GitHub Actions는 Notion 단계만 건너뜁니다.

```text
NOTION_TOKEN
NOTION_DATA_SOURCE_ID
```

### Instagram 실제 게시 필수 Secrets

`INSTAGRAM_PUBLISH_ENABLED=true`일 때 필요합니다.

```text
META_ACCESS_TOKEN
INSTAGRAM_BUSINESS_ACCOUNT_ID
```

### Instagram 진단 권장 Secrets

게시 자체에는 필수가 아니지만 token 만료일과 scope를 `doctor publish`에서 확인하려면 설정합니다.

```text
META_APP_ID
META_APP_SECRET
```

### Variables

```text
OPENAI_MODEL
SUPABASE_STORAGE_BUCKET
META_TOKEN_EXPIRY_WARNING_DAYS
INSTAGRAM_PUBLISH_ENABLED
BRAND_COMPANY_NAME
BRAND_VOICE
BRAND_SERVICE_SUMMARY
BRAND_CTA_ENABLED
BRAND_CTA_LABEL
BRAND_CTA_URL
```

### Workflow 고정값

아래 값은 `.github/workflows/brand-pilot-schedule.yml`, `.github/workflows/brand-pilot-publish.yml`, `.github/workflows/brand-pilot-token-alert.yml`에 고정되어 있습니다. 특별한 이유가 없으면 GitHub Secret이나 Variable로 따로 만들지 않습니다.

```text
DATABASE_PROVIDER=supabase
SUPABASE_SCHEMA=public
OPENAI_BASE_URL=https://api.openai.com/v1
DISCORD_BASE_URL=https://discord.com/api/v10
NOTION_VERSION=2026-03-11
META_GRAPH_BASE_URL=https://graph.facebook.com/v25.0
```

운영 기준:

- collection workflow는 6시간마다 수집, 초안 생성, Discord 검수 요청, Notion sync를 실행합니다.
- publish workflow는 1시간마다 승인된 콘텐츠의 채널 payload 생성, 카드뉴스 렌더링, Storage 업로드, Notion sync/backup, 백업 완료된 published 산출물의 Storage cleanup을 실행합니다.
- `INSTAGRAM_PUBLISH_ENABLED` 기본값은 `false`입니다.
- `false`이면 publish workflow가 실제 Instagram 게시만 건너뛰고 render/upload/Notion backup/cleanup은 계속 처리합니다.
- `true`이면 publish workflow가 `doctor publish`를 먼저 실행한 뒤 `instagram publish --limit 3`으로 실제 Instagram 게시를 시도합니다.
- Meta 계정 인증이나 access token이 불안정한 동안에는 `false`를 유지합니다.
- Notion과 Meta 값은 해당 기능을 사용할 때만 필요합니다.

현재 workflow는 카드뉴스 렌더링을 위해 `windows-latest` runner를 사용합니다. 렌더러가 `scripts/render-instagram-card-news.ps1`의 Windows PowerShell 및 `System.Drawing` 기반이기 때문입니다.

현재 collection workflow는 6시간마다 실행됩니다.

```yaml
schedule:
  - cron: '17 */6 * * *'
```

현재 publish workflow는 1시간마다 실행됩니다.

```yaml
schedule:
  - cron: '11 * * * *'
```

현재 token alert workflow는 매일 실행됩니다.

```yaml
schedule:
  - cron: '31 0 * * *'
```

수동 검증은 GitHub Actions 화면의 `Run workflow`로 실행합니다.

## 운영 계정 전환 체크리스트

1. 새 Supabase 프로젝트에 `supabase/schema.sql` 적용
2. Storage bucket 생성 SQL 적용: `supabase/storage.sql`
3. 필요한 보강 SQL 적용: `supabase/publish-lock.sql`, `supabase/notion-artifact-backup.sql`
4. Storage bucket public 접근 확인
5. 로컬 `.env`를 운영 값으로 교체
6. `doctor schedule`, `doctor discord`, `doctor notion`, `doctor publish`, `alert meta-token-expiry` 실행
7. Discord Edge Function secrets 재설정 및 재배포
8. Discord Interactions Endpoint URL이 Supabase function URL인지 확인
9. GitHub Actions Secrets/Variables를 운영 값으로 교체
10. GitHub Actions `workflow_dispatch`로 수동 실행
11. `--limit 1`로 draft/review/channel/render/upload/publish 흐름 검증

## 검증 명령 모음

```powershell
node --no-warnings=ExperimentalWarning src/cli.js doctor schedule
node --no-warnings=ExperimentalWarning src/cli.js doctor discord
node --no-warnings=ExperimentalWarning src/cli.js doctor notion
node --no-warnings=ExperimentalWarning src/cli.js doctor publish
node --no-warnings=ExperimentalWarning src/cli.js alert meta-token-expiry
node --no-warnings=ExperimentalWarning src/cli.js status
node --no-warnings=ExperimentalWarning src/cli.js review check
node --no-warnings=ExperimentalWarning src/cli.js notion check
node --no-warnings=ExperimentalWarning src/cli.js notion backup --limit 10
node --no-warnings=ExperimentalWarning --test
```

Meta가 아직 불가능한 상태에서는 실제 게시 대신 다음 명령으로 상태 전이를 검증합니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js instagram publish --mock --limit 1
```
