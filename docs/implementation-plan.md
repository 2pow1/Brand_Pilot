# Implementation Plan

이 문서는 Brand Pilot MVP 구현 순서를 추적하기 위한 작업 지도입니다.

## 전체 단계

1. 저장소와 기획 산출물 정리
   - GitHub 관리, README, 환경 변수 예시, 흐름도 정리
2. 내부 상태 기반 앱 골격
   - 로컬 개발은 SQLite로 빠르게 검증
   - 운영 source of truth는 Supabase Postgres로 전환
   - 상태 전이, CLI, 테스트 유지
3. 자료 수집
   - 지정 소스 fetch, HTML 후보 추출, 중복 저장 방지
4. 공통 초안 생성
   - 수집 후보를 GPT 검수용 공통 초안으로 변환
   - API 키 없이 확인 가능한 mock 모드 유지
5. 검수 요청
   - Discord 메시지와 승인/거절 버튼 payload 생성
   - 인터랙션 서버 전까지 CLI 승인/거절 지원
6. 채널별 콘텐츠 생성
   - 승인된 공통 초안을 Instagram 카드뉴스 payload로 변환
   - Blog, Facebook, LinkedIn은 같은 구조로 확장 가능하게 유지
7. Instagram 산출물 생성
   - 1080x1080 카드뉴스 이미지 렌더링
   - caption, hashtags, CTA, QR target 확인
8. Instagram 게시
   - Meta/Instagram Graph API 연동
   - Professional 계정, access token, business account id 필요
9. Notion 기록 미러
   - 콘텐츠 상태, 원문, 초안, 채널 출력, 게시 결과 기록
   - Notion은 source of truth가 아니라 읽기/확인용 미러
10. 자동 반복과 운영 보조
   - scheduler 실행
   - 재시도, 실패 기록, 상태 페이지

## 현재 구현 위치

현재 코드는 7단계까지 로컬에서 검증되었습니다.

- `collect`: 자료 후보를 `collected`로 저장
- `draft`: 초안을 생성해 `draft_created`로 전환
- `review request`: 검수 요청 후 `pending_review`로 전환
- `review approve/reject`: 검수 결과 기록
- `channel generate`: 승인된 초안을 Instagram 카드뉴스 payload로 변환하고 `channel_generated`로 전환
- `instagram render`: Instagram payload를 1080x1080 PNG 5장과 manifest로 렌더링하고 `publish_pending`으로 전환

다음 구현 단계는 8단계 Instagram 실제 게시 또는 9단계 Notion 기록 미러입니다.

## 운영 DB 기준

운영 환경에서는 Supabase Postgres를 상태 저장소로 사용합니다.

로컬 개발에서는 `DATABASE_PROVIDER=sqlite`로 SQLite를 계속 사용할 수 있습니다. 무료 우선 운영에서는 GitHub Actions schedule이 `DATABASE_PROVIDER=supabase`와 Supabase URL/key를 사용해 주기 job을 실행하고, `supabase/schema.sql`을 적용한 Postgres 테이블을 source of truth로 둡니다.

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
