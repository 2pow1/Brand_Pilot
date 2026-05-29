# Discord Review Setup

Brand Pilot의 Discord 검수는 두 단계로 동작합니다.

1. CLI 또는 GitHub Actions가 검수 채널에 승인/거절 버튼이 달린 메시지를 보냅니다.
2. 검토자가 버튼을 누르면 Discord가 Supabase Edge Function을 호출하고, Edge Function이 Supabase 상태를 `approved` 또는 `rejected`로 변경합니다.

## 필요한 값

로컬 `.env`와 운영 환경에는 아래 값이 필요합니다.

```text
DISCORD_BOT_TOKEN=
DISCORD_REVIEW_CHANNEL_ID=
DISCORD_PUBLIC_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

각 값의 확인 위치:

| 값 | 확인 위치 | 저장 위치 |
|---|---|---|
| `DISCORD_BOT_TOKEN` | Discord Developer Portal -> Applications -> 대상 앱 -> Bot -> Token | 로컬 `.env`, GitHub Secret |
| `DISCORD_REVIEW_CHANNEL_ID` | Discord 개발자 모드 활성화 후 검수 채널 우클릭 -> Copy Channel ID | 로컬 `.env`, GitHub Secret |
| `DISCORD_PUBLIC_KEY` | Discord Developer Portal -> Applications -> 대상 앱 -> General Information -> Public Key | 로컬 `.env`, Supabase Secret |
| `SUPABASE_URL` | Supabase Project Settings -> API -> Project URL | 로컬 `.env`, GitHub Secret, Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings -> API -> service_role key | 로컬 `.env`, GitHub Secret, Supabase runtime |

`SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`는 Supabase Edge Function 런타임에서 기본 제공되는 예약 환경 변수입니다. Supabase CLI로 `--env-file .env`를 적용할 때 `SUPABASE_`로 시작하는 값이 skip되어도 정상입니다.

## Discord 앱과 봇 설정

1. [Discord Developer Portal](https://discord.com/developers/applications)에 접속합니다.
2. Brand Pilot용 Application을 선택하거나 새로 만듭니다.
3. `Bot` 메뉴에서 bot을 생성하고 token을 발급합니다.
4. `OAuth2 -> URL Generator`에서 아래 scope를 선택합니다.

```text
bot
applications.commands
```

5. Bot permissions는 최소 아래 권한을 포함합니다.

```text
View Channel
Send Messages
Read Message History
```

6. 생성된 초대 URL로 검수용 Discord 서버에 bot을 추가합니다.
7. 검수 채널에서 bot이 메시지를 볼 수 있고 보낼 수 있는지 확인합니다.

현재 메시지는 일반 텍스트와 버튼만 사용하므로 파일 첨부 권한은 필수는 아닙니다.

## 채널 ID 확인

Discord 채널 ID를 복사하려면 먼저 개발자 모드를 켭니다.

```text
Discord
-> User Settings
-> Advanced
-> Developer Mode 활성화
-> 검수 채널 우클릭
-> Copy Channel ID
```

복사한 값이 `DISCORD_REVIEW_CHANNEL_ID`입니다. 서버 ID, 카테고리 ID, 메시지 ID와 혼동하지 않습니다.

## 로컬 검증

메시지를 보내기 전에 토큰과 채널 접근성을 확인합니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js doctor discord
node --no-warnings=ExperimentalWarning src/cli.js review check
```

정상 응답 예:

```json
{
  "ok": true,
  "botId": "1504787708072034334",
  "botUsername": "Brand_Pilot",
  "channelId": "1504789680355282985",
  "channelName": "ch_bot",
  "channelType": 0
}
```

`Missing Access`가 나오면 값 형식은 맞지만 bot이 해당 채널을 볼 수 없는 상태입니다.

확인할 것:

- bot이 해당 Discord 서버에 초대되어 있는지
- `DISCORD_REVIEW_CHANNEL_ID`가 실제 텍스트 채널 ID인지
- 채널 권한에서 bot에게 `View Channel`, `Send Messages`, `Read Message History`가 허용되어 있는지

`Unknown Channel`이 나오면 채널 ID가 틀렸거나 bot이 해당 서버에 없습니다.

## 검수 메시지 전송

실제 검수 메시지를 보내려면 `draft_created` 상태의 콘텐츠가 있어야 합니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js review request --limit 1
```

메시지에는 `승인`, `거절` 버튼이 포함됩니다. 버튼의 `custom_id`에는 콘텐츠 ID와 결정값이 들어가며, Edge Function이 이 값을 읽어 상태를 바꿉니다.

## Supabase Edge Function 배포

Discord 버튼 이벤트를 받는 함수는 `supabase/functions/discord-review`입니다.

먼저 Supabase project에 Discord public key를 설정합니다.

```powershell
npx supabase secrets set DISCORD_PUBLIC_KEY=<discord-application-public-key> --project-ref <project-ref>
```

그 다음 함수를 배포합니다.

```powershell
npx supabase functions deploy discord-review --no-verify-jwt --project-ref <project-ref> --use-api
```

`supabase/config.toml`에서는 `discord-review`의 Supabase JWT 검증을 끕니다. Discord가 이 endpoint를 직접 호출하기 때문입니다. 대신 함수 내부에서 Discord의 Ed25519 signature를 검증한 뒤에만 Supabase 상태를 변경합니다.

## Discord Interactions Endpoint URL

배포 후 Discord Developer Portal에 아래 URL을 등록합니다.

```text
https://<project-ref>.supabase.co/functions/v1/discord-review
```

등록 위치:

```text
Discord Developer Portal
-> Applications
-> 대상 앱
-> General Information
-> Interactions Endpoint URL
```

저장 시 Discord가 검증용 ping을 보내고, Edge Function은 `PONG`으로 응답해야 합니다. 저장이 실패하면 `DISCORD_PUBLIC_KEY`, 함수 배포 상태, URL의 project ref를 확인합니다.

## GitHub Actions와의 관계

GitHub Actions는 `review request --limit 3`으로 Discord 검수 메시지를 보냅니다. 버튼 클릭 처리는 GitHub Actions가 아니라 Supabase Edge Function이 담당합니다.

필요한 GitHub Secrets:

```text
DISCORD_BOT_TOKEN
DISCORD_REVIEW_CHANNEL_ID
```

필요한 Supabase Secret:

```text
DISCORD_PUBLIC_KEY
```

GitHub Actions에는 `DISCORD_PUBLIC_KEY`가 필수는 아닙니다. 이 값은 Discord interaction 서명 검증을 위해 Edge Function에서 사용합니다.

## 수동 대체 명령

Edge Function 등록 전이거나 버튼 처리에 문제가 있으면 CLI로 검수 결정을 직접 기록할 수 있습니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js review approve <content-id>
node --no-warnings=ExperimentalWarning src/cli.js review reject <content-id> "reason"
```

이 방식은 Discord 버튼을 누른 것과 동일하게 Supabase 상태를 변경하지만, Discord 메시지 자체의 버튼 상태는 갱신하지 않습니다.
