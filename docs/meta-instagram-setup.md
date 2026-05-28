# Meta / Instagram Setup

이 문서는 Meta Developers에 앱이 없는 상태에서 Brand Pilot의 Instagram 실제 게시용 API 값을 새로 발급하는 절차를 정리합니다. 현재 MVP는 **Instagram API with Facebook Login** 흐름을 사용합니다. 즉 Instagram Professional 계정, 연결된 Facebook Page, Meta Developer App, Facebook Login 기반 User Access Token이 필요합니다.

참고 공식 문서:

- Meta Instagram API with Facebook Login Getting Started: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started
- Meta Long-Lived Access Tokens: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
- Meta Content Publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing/

## 목표 값

Instagram 실제 게시에 필수인 값과 진단에 필요한 권장값을 분리합니다.

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

`META_ACCESS_TOKEN`은 Instagram 게시에 사용할 long-lived user access token입니다. `INSTAGRAM_BUSINESS_ACCOUNT_ID`는 Facebook Page ID가 아니라 Page에 연결된 Instagram Business/Creator account의 IG User ID입니다.

`META_APP_ID`와 `META_APP_SECRET`은 게시 호출 자체에는 필수는 아니지만, `doctor publish`가 Meta token debugger로 토큰 유효성, 만료일, scope를 확인할 때 필요합니다. 운영 안정성을 위해 설정하는 것을 권장합니다.

## 사전 조건

1. Instagram 계정이 Professional 계정이어야 합니다.
   - Business 또는 Creator 계정이면 됩니다.
2. Instagram 계정이 Facebook Page와 연결되어 있어야 합니다.
3. 토큰을 발급하는 Facebook 계정이 해당 Facebook Page에서 적절한 작업 권한을 가져야 합니다.
   - 최소한 Page를 조회하고 콘텐츠를 만들 수 있는 권한이 필요합니다.
4. Meta Developer 계정으로 로그인할 수 있어야 합니다.

Meta 공식 Getting Started 문서도 Instagram Business/Creator account, 연결된 Facebook Page, 해당 Page에서 작업을 수행할 수 있는 Developer account, 등록된 Facebook App을 전제로 합니다.

## 1. Meta Developer 앱 생성

1. Meta Developers에 로그인합니다.
2. `내 앱`으로 이동합니다.
3. `앱 만들기`를 선택합니다.
4. 앱 이름을 입력합니다.
5. 앱 유형 또는 이용 사례 선택 화면이 나오면 Instagram 콘텐츠 관리/게시가 가능한 흐름을 선택합니다.
   - UI가 바뀌어 정확한 문구가 다를 수 있습니다.
   - Graph API Explorer에서 아래 권한을 추가할 수 있어야 합니다.
     - `instagram_basic`
     - `instagram_content_publish`
     - `pages_show_list`
     - `pages_read_engagement`
6. 앱이 생성되면 `App settings -> Basic`으로 이동합니다.
7. `App ID`를 진단 권장값 `META_APP_ID`로 기록합니다.
8. `App secret`을 표시해서 진단 권장값 `META_APP_SECRET`으로 기록합니다.

주의:

- 값은 문서나 Git에 적지 않습니다.
- 로컬 `.env`, Supabase/GitHub Secrets에만 넣습니다.

## 2. Facebook Login 제품 추가

1. 생성한 앱의 Dashboard로 이동합니다.
2. 제품 추가 또는 Use cases 설정에서 `Facebook Login`을 추가합니다.
3. Facebook Login 설정은 우선 기본값으로 둡니다.
4. Graph API Explorer로 수동 토큰을 발급해 검증하는 단계에서는 redirect URI를 직접 구현하지 않아도 됩니다.

공식 Getting Started 문서는 Instagram API with Facebook Login을 쓰기 위해 앱에 Facebook Login product를 추가하라고 안내합니다.

## 3. Graph API Explorer에서 단기 User Token 발급

1. Graph API Explorer를 엽니다.
   - https://developers.facebook.com/tools/explorer/
2. 우측 또는 상단의 앱 선택에서 방금 만든 앱을 선택합니다.
3. Token Type은 `User Token`을 선택합니다.
4. 권한 추가에서 아래 권한을 추가합니다.

```text
instagram_basic
instagram_content_publish
pages_show_list
pages_read_engagement
```

5. `Generate Access Token`을 누릅니다.
6. 권한 동의 창에서 운영 Facebook 계정으로 로그인하고 권한을 허용합니다.
7. Access Token 입력칸에 단기 User Access Token이 생성됩니다.

주의:

- Graph API Explorer에서 선택한 앱이 실제 Brand Pilot용 앱이어야 합니다.
- 다른 앱으로 토큰을 발급하면 `META_APP_ID`, `META_APP_SECRET`으로 debug할 때 맞지 않을 수 있습니다.
- Facebook 계정이 연결된 Page 권한을 갖고 있지 않으면 `/me/accounts`가 비거나 Instagram account가 나오지 않습니다.

## 4. Facebook Page와 Instagram Business Account ID 확인

Graph API Explorer에서 아래 요청을 실행합니다.

```text
GET /me/accounts?fields=id,name,tasks,instagram_business_account{id,username}
```

정상 응답 예:

```json
{
  "data": [
    {
      "id": "123456789012345",
      "name": "Client Facebook Page",
      "tasks": ["CREATE_CONTENT", "MANAGE", "MODERATE"],
      "instagram_business_account": {
        "id": "17841400000000000",
        "username": "client_instagram"
      }
    }
  ]
}
```

여기서 사용할 값:

```text
Facebook Page ID: data[].id
INSTAGRAM_BUSINESS_ACCOUNT_ID: data[].instagram_business_account.id
```

`INSTAGRAM_BUSINESS_ACCOUNT_ID`에 Facebook Page ID를 넣으면 안 됩니다.

만약 `instagram_business_account`가 보이지 않으면 Page ID를 확인한 뒤 아래 요청도 실행합니다.

```text
GET /{page-id}?fields=instagram_business_account{id,username}
```

그래도 보이지 않으면 아래를 확인합니다.

- Instagram 계정이 Professional 계정인지
- Instagram 계정이 해당 Facebook Page와 연결되어 있는지
- 토큰을 발급한 Facebook 계정이 해당 Page의 작업 권한을 갖는지
- Graph API Explorer에서 올바른 앱을 선택했는지
- 토큰에 `instagram_basic`, `pages_show_list` 권한이 포함되어 있는지

## 5. 단기 토큰을 Long-Lived User Token으로 교환

Graph API Explorer에서 받은 단기 token은 오래가지 않습니다. 운영 테스트에는 long-lived user access token을 사용합니다. Meta 공식 문서 기준 long-lived user token은 보통 약 60일 동안 유효합니다.

브라우저 또는 터미널에서 아래 요청을 실행합니다. 실제 값은 노출하지 않습니다.

```text
GET https://graph.facebook.com/v25.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={META_APP_ID}
  &client_secret={META_APP_SECRET}
  &fb_exchange_token={short-lived-user-access-token}
```

응답 예:

```json
{
  "access_token": "LONG_LIVED_USER_ACCESS_TOKEN",
  "token_type": "bearer",
  "expires_in": 5183944
}
```

응답의 `access_token`을 `META_ACCESS_TOKEN`으로 사용합니다.

주의:

- 만료된 단기 token은 long-lived token으로 교환할 수 없습니다.
- `client_secret`이 들어가는 요청은 서버 또는 개발자 로컬 환경에서만 실행합니다.
- long-lived token도 만료되므로 `doctor publish`로 만료일을 주기적으로 확인합니다.

## 6. 로컬 `.env` 적용

게시 필수값:

```env
META_ACCESS_TOKEN=<long-lived-user-access-token>
INSTAGRAM_BUSINESS_ACCOUNT_ID=<instagram-business-account-id>
```

진단 권장값:

```env
META_APP_ID=<app-id>
META_APP_SECRET=<app-secret>
```

운영 옵션값:

```env
META_TOKEN_EXPIRY_WARNING_DAYS=7
META_GRAPH_BASE_URL=https://graph.facebook.com/v25.0
```

검증합니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js doctor publish
```

정상 예:

```text
Doctor target: publish
Status: ok
[ok] META_ACCESS_TOKEN
[ok] INSTAGRAM_BUSINESS_ACCOUNT_ID
[ok] SUPABASE_STORAGE_BUCKET
[ok] META_ACCESS_TOKEN_VALID
[ok] META_ACCESS_TOKEN_EXPIRY
[ok] META_ACCESS_TOKEN_SCOPES
[ok] INSTAGRAM_BUSINESS_ACCOUNT_ACCESS
```

`META_APP_ID`와 `META_APP_SECRET`을 설정하지 않아도 `META_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`, `SUPABASE_STORAGE_BUCKET` 확인은 가능합니다. 다만 이 경우 token debugger 기반의 만료일/scope 진단은 경고로 표시됩니다.

`META_ACCESS_TOKEN_SCOPES`에서 실패하면 토큰에 `instagram_basic`, `instagram_content_publish`가 없는 것입니다. Graph API Explorer에서 권한을 다시 추가하고 토큰을 재발급합니다.

`INSTAGRAM_BUSINESS_ACCOUNT_ACCESS`에서 실패하면 `INSTAGRAM_BUSINESS_ACCOUNT_ID`가 틀렸거나, token을 발급한 Facebook 계정이 해당 Instagram account에 접근할 수 없는 상태입니다.

## 7. 게시 테스트

먼저 현재 pipeline 상태를 봅니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js status
```

이미 `publish_pending`이고 public artifact URL이 준비된 항목이 있으면 실제 게시를 1건만 테스트합니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js instagram publish --limit 1
```

아직 public artifact가 없으면 아래 순서로 진행합니다.

```powershell
node --no-warnings=ExperimentalWarning src/cli.js channel generate --limit 1
node --no-warnings=ExperimentalWarning src/cli.js instagram render --limit 1
node --no-warnings=ExperimentalWarning src/cli.js instagram upload --limit 1
node --no-warnings=ExperimentalWarning src/cli.js instagram publish --limit 1
```

게시 후 Instagram 앱/웹에서 실제 게시물을 확인합니다. 테스트 게시물이라면 확인 후 삭제해도 됩니다.

## 8. GitHub Actions에 운영 값 적용

GitHub repository:

```text
Settings
-> Secrets and variables
-> Actions
```

게시 필수 Secrets:

```text
META_ACCESS_TOKEN
INSTAGRAM_BUSINESS_ACCOUNT_ID
```

진단 권장 Secrets:

```text
META_APP_ID
META_APP_SECRET
```

Variables:

```text
META_TOKEN_EXPIRY_WARNING_DAYS=7
INSTAGRAM_PUBLISH_ENABLED=false
```

`META_GRAPH_BASE_URL`은 workflow에서 `https://graph.facebook.com/v25.0`으로 고정되어 있으므로 GitHub Secret이나 Variable로 관리하지 않습니다.

처음에는 `INSTAGRAM_PUBLISH_ENABLED=false`로 둡니다. 이 상태에서는 GitHub Actions가 render/upload까지는 진행하지만 실제 Instagram 게시 step은 건너뜁니다.

수동 실행으로 전체 pipeline이 정상인지 확인한 뒤, 실제 자동 게시를 켤 때만 아래처럼 바꿉니다.

```text
INSTAGRAM_PUBLISH_ENABLED=true
```

## 9. Development Mode와 App Review 기준

현재 MVP처럼 클라이언트 운영 계정 하나를 개발자가 관리하고, token을 발급한 Facebook 계정이 앱 role과 Page 권한을 갖고 있다면 Development Mode에서도 테스트가 가능합니다.

다만 나중에 여러 외부 사용자가 각자 Instagram 계정을 연결하는 SaaS 형태로 확장하려면 다음이 필요합니다.

- App Review
- 필요한 권한의 Advanced Access
- Live Mode 전환
- OAuth 로그인/재동의 흐름 구현

현재 Brand Pilot은 OAuth 기반 다중 사용자 연결이 아니라 운영 계정의 서버-side token을 사용하는 구조입니다. 따라서 지금 단계에서는 App Review보다 운영 계정 token 발급, 만료 감지, 수동 갱신 절차를 먼저 안정화합니다.

## 문제 상황별 점검

`/me/accounts`가 빈 배열:

- Facebook 계정이 Page 권한을 갖고 있는지 확인합니다.
- Page가 실제로 생성되어 있는지 확인합니다.
- 앱 선택이 잘못되지 않았는지 확인합니다.
- `pages_show_list` 권한이 token에 포함되어 있는지 확인합니다.

`instagram_business_account`가 없음:

- Instagram Professional 계정이 Facebook Page에 연결되어 있는지 확인합니다.
- Instagram 앱 또는 Meta Business Suite에서 Page 연결 상태를 다시 확인합니다.
- Page ID로 `GET /{page-id}?fields=instagram_business_account{id,username}`를 직접 호출합니다.

`doctor publish`에서 token 만료:

- Graph API Explorer에서 단기 token을 다시 발급합니다.
- long-lived token 교환 요청을 다시 실행합니다.
- `.env`와 GitHub Secret의 `META_ACCESS_TOKEN`을 교체합니다.

`instagram publish`는 성공했는데 앱에서 게시물이 바로 안 보임:

- Instagram 앱을 새로고침하거나 웹 permalink를 확인합니다.
- CLI 출력의 `publishedUrl`을 우선 확인합니다.
