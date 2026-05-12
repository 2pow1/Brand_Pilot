# Brand Pilot Flow Artifacts

이 폴더는 Brand Pilot 기획 과정에서 만든 순서도 이미지와 재생성 스크립트를 정리한 공간입니다.

## 현재 기준 파일

- `final/brand-pilot-client-user-flow-v2.png`
  - 클라이언트가 실제로 알아야 하는 사용자 흐름도입니다.
- `final/brand-pilot-program-flow-v2.png`
  - 크롤링, GPT 초안 생성, Discord 검수, 채널별 콘텐츠 생성, Instagram 게시까지 포함한 프로그램 동작 순서도입니다.

## 소스

- `source/render-revised-flows-png.ps1`
  - 현재 기준 PNG 2개를 다시 생성하는 스크립트입니다.
  - 실행 위치와 관계없이 결과물은 `final/` 폴더에 저장됩니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\artifacts\flows\source\render-revised-flows-png.ps1
```

## 보관 파일

- `archive/`
  - 클라이언트 전제가 정정되기 전의 흐름도, 단순 버전, 중간 산출물, 이전 렌더링 스크립트를 보관합니다.
  - 현재 개발 기준으로 참고할 파일은 아닙니다.

## 현재 전제

이 서비스는 클라이언트가 타사를 브랜딩해주는 사업을 홍보하기 위해, 클라이언트 자사의 콘텐츠 생성과 게시 과정을 자동화하는 프로토타입입니다. Notion은 기록 확인용 미러이며, 실제 상태 관리는 애플리케이션 내부 저장소에서 처리합니다.
