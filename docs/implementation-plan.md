# Implementation Plan

이 문서는 Brand Pilot MVP 구현 범위와 현재 자동화 흐름을 추적하기 위한 작업 기록입니다.

## 전체 단계

1. 저장소와 기획 산출물 정리
   - GitHub 저장소 관리
   - README, 환경 변수 예시, 흐름도 정리
2. 내부 상태 기반 골격 구현
   - 로컬 개발은 SQLite로 빠르게 검증
   - 운영 source of truth는 Supabase Postgres로 전환
   - 상태 전이, CLI, 테스트 추가
3. 자료 수집
   - 지정된 해외/국내 자료 source fetch
   - HTML 후보 추출
   - URL/제목 fingerprint 기반 중복 저장 방지
4. 공통 초안 생성
   - 수집 후보를 GPT 검수용 공통 초안으로 변환
   - API 없이 확인 가능한 mock 모드 제공
   - 클라이언트가 요구한 JSON schema 형태로 초안 정규화
5. Discord 검수 요청
   - 승인/거절 버튼이 있는 검수 메시지 생성
   - Supabase Edge Function으로 버튼 이벤트 처리
   - Edge Function 이전에는 CLI 수동 승인/거절 지원
6. 채널별 콘텐츠 생성
   - 승인된 공통 초안을 Instagram 카드뉴스 payload로 변환
   - Blog, Facebook, LinkedIn 등 다른 채널로 확장 가능한 구조 유지
7. Instagram 산출물 생성
   - 1080x1080 카드뉴스 이미지 5장 렌더링
   - caption, hashtags, 브랜드명 확인
   - CTA URL이 설정된 경우에만 CTA, QR target URL 포함
8. Instagram 게시
   - Supabase Storage public URL 업로드
   - Meta / Instagram Graph API 게시
   - publish lock과 retry backoff로 중복 게시 방지
9. Notion 기록 미러와 백업
   - 콘텐츠 상태, 원문, 초안, 채널 출력, 게시 결과 기록
   - Supabase Storage 파일을 Notion-hosted file로 백업
   - Notion은 source of truth가 아니라 읽기용 미러로 유지
10. 반복 운영과 유지보수
   - GitHub Actions schedule 실행
   - Discord 검수 대기 중에도 수집/초안 생성 병렬 진행
   - 토큰 만료 진단
   - Storage cleanup으로 Supabase 무료 용량 관리

## 현재 구현 위치

현재 코드는 Instagram 실제 게시와 Notion 백업까지 검증 가능한 상태입니다.

- `collect`: 자료 후보를 `collected`로 저장
- `draft`: GPT 또는 mock으로 공통 초안을 생성하고 `draft_created`로 전환
- `review request`: Discord 검수 요청 후 `pending_review`로 전환
- `review approve/reject`: 검수 결과 기록
- Discord Edge Function: 버튼 클릭으로 Supabase 상태 변경
- `channel generate`: 승인된 초안을 Instagram 카드뉴스 payload로 변환하고 `channel_generated`로 전환
- `instagram render`: Instagram payload를 1080x1080 PNG 5장과 manifest로 렌더링하고 `publish_pending`로 전환
- `instagram upload`: 로컬 렌더 산출물을 Supabase Storage public bucket에 업로드하고 public manifest URL 기록
- `instagram publish`: public image URL이 준비된 카드뉴스를 Instagram Graph API로 게시하고 `published`로 전환
- `instagram publish --mock`: Meta API 호출 없이 게시 상태 전이를 검증
- `notion sync`: Supabase/SQLite 콘텐츠 상태를 Notion 읽기용 미러에 생성/업데이트
- `notion backup`: Supabase Storage public artifact를 Notion-hosted file로 백업
- `storage cleanup`: Notion 백업이 완료된 published artifact를 Supabase Storage에서 정리
- `doctor *`: schedule, Discord, Notion, Instagram 게시 설정 진단

## 운영 DB 기준

운영 환경에서는 Supabase Postgres를 상태 저장소로 사용합니다.

로컬 개발에서는 `DATABASE_PROVIDER=sqlite`로 SQLite를 계속 사용할 수 있습니다. 무료 우선 운영에서는 GitHub Actions schedule이 `DATABASE_PROVIDER=supabase`와 Supabase URL/key를 사용해 주기 job을 실행하고, `supabase/schema.sql`이 적용된 Postgres table을 source of truth로 둡니다.

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

검수 대기 중인 콘텐츠가 있어도 다음 후보 수집과 초안 생성은 병렬로 진행할 수 있습니다.

## 운영 자동화 기준

현재 GitHub Actions는 수집 workflow와 게시 workflow로 나뉩니다.

수집 workflow는 6시간마다 아래 작업을 실행합니다.

```text
doctor schedule
status
collect
draft
review request
notion sync             # Notion 값이 있을 때만
```

게시 workflow는 1시간마다 아래 작업을 실행합니다.

```text
status
channel generate
instagram render
instagram upload
doctor publish          # INSTAGRAM_PUBLISH_ENABLED=true일 때만
instagram publish       # INSTAGRAM_PUBLISH_ENABLED=true일 때만
notion sync             # Notion 값이 있을 때만
notion backup           # Notion 값이 있을 때만
```

게시 즉시성이 더 필요해지면 수집/초안 생성용 schedule과 게시 전용 schedule을 분리합니다. 게시 전용 job은 승인 후 생성된 `publish_pending` 항목만 더 자주 확인하도록 만들 수 있습니다.

## 남은 개선 후보

- 게시 전용 GitHub Actions workflow 분리
- Meta token 갱신 운영 절차 자동 알림
- Supabase Storage cleanup을 운영 schedule에 포함할 시점 결정
- 상태 페이지 또는 간단한 운영 대시보드
- Blog, Facebook, LinkedIn 채널 template 추가
- Notion 백업 완료 후 오래된 DB row archive 정책 설계
