# Discord Review Setup

Brand Pilot의 Discord 검수는 두 단계로 나뉩니다.

1. CLI 또는 GitHub Actions가 검수 채널에 승인/거절 버튼이 달린 메시지를 보냅니다.
2. Discord가 버튼 클릭을 Supabase Edge Function으로 보내고, Edge Function이 Supabase 상태를 `approved` 또는 `rejected`로 바꿉니다.

## 필요한 값

로컬 `.env`와 GitHub Actions Secrets에 아래 값을 등록합니다.

```text
DISCORD_BOT_TOKEN=
DISCORD_REVIEW_CHANNEL_ID=
DISCORD_PUBLIC_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`DISCORD_BOT_TOKEN`은 Discord Developer Portal의 Bot 토큰입니다. `DISCORD_PUBLIC_KEY`는 같은 애플리케이션의 General Information 화면에서 확인합니다. `DISCORD_REVIEW_CHANNEL_ID`는 검수 메시지를 받을 채널 ID입니다.

## 봇 권한

봇은 검수 채널에서 최소한 아래 권한이 필요합니다.

```text
View Channel
Send Messages
Use External Emojis는 필요 없음
```

현재 메시지는 일반 텍스트와 버튼만 사용하므로 첨부 파일 권한은 필요하지 않습니다.

## 로컬 확인

메시지를 보내기 전에 토큰과 채널 접근성을 확인합니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js doctor discord
node --no-warnings=ExperimentalWarning src/cli.js review check
```

`review check`가 `Missing Access`를 출력하면 값은 들어갔지만 봇이 해당 채널을 볼 수 없는 상태입니다.

1. Discord 서버에 봇이 초대되어 있는지 확인합니다.
2. `DISCORD_REVIEW_CHANNEL_ID`가 서버 ID, 카테고리 ID, 메시지 ID가 아니라 실제 텍스트 채널 ID인지 확인합니다.
3. 채널 권한에서 봇 역할에 `View Channel`과 `Send Messages`를 허용합니다.

실제 검수 메시지를 보내려면 `draft_created` 상태의 콘텐츠가 있어야 합니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js review request --limit 1
```

## 버튼 수신

Supabase Edge Function에 필요한 secrets를 설정합니다.

```powershell
npx supabase secrets set DISCORD_PUBLIC_KEY=... --project-ref finhgkhvhpzdizzmhldp
```

`discord-review`는 Discord가 직접 호출하는 공개 웹훅이므로 `supabase/config.toml`에서 이 함수의 Supabase JWT 검증을 끕니다. 대신 함수 내부에서 Discord 서명을 검증한 뒤에만 Supabase 상태를 바꿉니다.

`SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`는 Supabase Edge Function 런타임의 기본 환경값으로 제공됩니다. `supabase secrets set --env-file .env` 실행 시 `SUPABASE_`로 시작하는 값이 skip되어도 정상입니다.

그 다음 Edge Function을 배포합니다.

```powershell
npx supabase functions deploy discord-review --no-verify-jwt --project-ref finhgkhvhpzdizzmhldp --use-api
```

Discord Developer Portal의 Interactions Endpoint URL에는 배포된 Edge Function URL을 등록합니다.

```text
https://<project-ref>.supabase.co/functions/v1/discord-review
```

등록이 성공하면 Discord가 자동으로 서명 검증용 ping을 보내고, Edge Function은 `PONG`으로 응답합니다.
