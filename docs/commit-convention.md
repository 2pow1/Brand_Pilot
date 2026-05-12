# Commit Convention

이 프로젝트는 커밋 목록만 봐도 변경 의도, 영향 범위, 원복 단위를 빠르게 파악할 수 있도록 아래 규칙을 사용합니다.

## 기본 형식

```text
<type>(<scope>): <summary>
```

예시:

```text
feat(collect): store source candidates with duplicate guard
fix(collect): exclude taxonomy pages from candidates
docs(flow): update program flow premise
test(db): cover duplicate content insertion
chore(repo): add git attributes and env template
```

## Type

- `feat`: 사용자나 운영 흐름에 새 기능 추가
- `fix`: 버그 수정
- `docs`: 문서, 흐름도, 기획 기록 변경
- `test`: 테스트 추가 또는 수정
- `refactor`: 동작 변경 없이 구조 개선
- `config`: 소스, 채널, 브랜드 설정 변경
- `chore`: 저장소 관리, 빌드/도구 설정, 기타 유지보수
- `release`: 버전 태그나 배포 준비
- `revert`: 이전 커밋 원복

## Scope

가능하면 아래 프로젝트 도메인 기준 scope를 사용합니다.

- `repo`: Git, README, 공통 저장소 설정
- `flow`: 사용자 흐름도, 프로그램 동작 순서도
- `config`: `config/` 아래 설정
- `db`: SQLite schema, repository, 상태 저장
- `state`: 상태값과 상태 전이
- `collect`: 자료 수집, fetch, HTML 후보 추출
- `draft`: GPT 초안 생성
- `review`: 승인/거절 검수 흐름
- `discord`: Discord 메시지/버튼 연동
- `notion`: Notion 기록 미러
- `channel`: 채널별 콘텐츠 변환 공통 로직
- `instagram`: Instagram 카드뉴스/게시
- `status`: 상태 페이지나 상태 확인 CLI
- `test`: 테스트 인프라

## Summary

- 영어 소문자 명령형을 기본으로 사용합니다.
- 72자 안팎으로 짧게 씁니다.
- 마침표를 붙이지 않습니다.
- 무엇을 했는지보다, 이 커밋이 어떤 단위로 되돌릴 수 있는지 드러나게 씁니다.

좋은 예:

```text
feat(draft): generate review-ready drafts from collected sources
```

애매한 예:

```text
update draft stuff
```

## Body

단순 커밋은 제목만으로 충분합니다. 다만 아래 중 하나라도 해당하면 본문을 남깁니다.

- 되돌릴 때 주의할 점이 있음
- API, DB schema, 상태 전이를 바꿈
- 외부 서비스 연동 방식이 바뀜
- 임시 구현 또는 의도적으로 남긴 제한이 있음

본문 형식:

```text
Why:
- 이 변경이 필요한 이유

What:
- 실제 변경 내용

Verify:
- 실행한 검증 명령

Rollback:
- 되돌릴 때 확인할 점
```

## Version And Release

2주 MVP 동안은 작은 기능 단위 커밋을 유지하고, 데모 가능한 지점에서 버전 태그를 붙입니다.

권장 태그:

```text
v0.1.0-planning
v0.2.0-collect
v0.3.0-draft
v0.4.0-review
v0.5.0-instagram
v1.0.0-mvp
```

릴리즈 커밋 예시:

```text
release(repo): tag v0.2.0-collect
```

## Revert

원복 커밋은 Git 기본 형식을 우선 사용합니다.

```powershell
git revert <commit-hash>
```

필요하면 제목은 아래처럼 정리합니다.

```text
revert(collect): remove source collection pipeline
```

본문에는 원본 커밋 해시를 남깁니다.

```text
Reverts: 0810a58
Reason: live source parsing produced low-quality candidates.
```

## Working Rules

- 커밋은 하나의 논리 단위로 묶습니다.
- `git add .`는 가능하면 피하고, 의도한 파일만 stage합니다.
- 테스트가 깨진 상태는 커밋하지 않습니다.
- 로컬 DB, `.env`, 토큰, 실행 산출물은 커밋하지 않습니다.
- push는 사용자가 직접 수행합니다.
