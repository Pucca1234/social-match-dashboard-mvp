# Current State — Social Match Dashboard MVP

> 최종 업데이트: 2026-03-06

## 기능 상태

| 기능 | 상태 | 브랜치 | 비고 |
|------|------|--------|------|
| 대시보드 UI (메트릭 테이블, 히트맵) | ✅ 완료 | main | |
| 필터 시스템 (기간/측정단위/필터값/지표) | ✅ 완료 | main | ControlBar + SegmentedButtonGroup |
| AI 분석 리포트 (요약 + 챗) | ✅ 완료 | main | /api/ai/summary, /api/ai/chat |
| 에러 로그 패널 | ✅ 완료 | main | |
| Google OAuth 인증 | ✅ 완료 | feature/auth | 로그인/로그아웃/사용자명 표시 |
| 필터 템플릿 저장/불러오기 | ✅ 완료 | feature/auth | DB 마이그레이션 실행 완료 |
| 필터 초기화 버튼 | ✅ 완료 | feature/auth | 필터 옆 위치 |

## 남은 작업
- [ ] feature/auth 브랜치 커밋 및 main PR 생성

## 인증 기능 상세

### 구현 완료 항목
- [x] 브라우저 클라이언트 (app/lib/supabase/client.ts)
- [x] 서버 클라이언트 (app/lib/supabase/server.ts)
- [x] 미들웨어 (app/lib/supabase/middleware.ts + middleware.ts)
- [x] OAuth 콜백 (app/auth/callback/route.ts)
- [x] 로그인 페이지 (app/login/page.tsx)
- [x] .env.local 환경변수 설정 (URL, SERVICE_ROLE_KEY, ANON_KEY)
- [x] Google Cloud OAuth Client ID 생성 + Supabase Provider 연동
- [x] 로그아웃 버튼 (헤더 header-meta 영역)
- [x] 사용자 이름 표시 (Google 프로필 이름)

## 필터 템플릿 기능 상세

### 구현 완료 항목
- [x] DB 스키마 (filter_templates 테이블, RLS, 트리거)
- [x] Supabase SQL Editor에서 마이그레이션 실행 완료
- [x] API CRUD (/api/filter-templates, /api/filter-templates/[id])
- [x] ControlBar UI (드롭다운 + 저장 다이얼로그)
- [x] page.tsx 템플릿 상태관리 + 핸들러
- [x] CSS 스타일
- [x] 필터 초기화 버튼 (필터 드롭다운 옆)

## 필터 초기화 기능
- 기간범위 → recent_8 (최근 8주)
- 측정단위 → all (전체)
- 필터 → all (전체)
- 지표 → 기본 6개 복원
- 템플릿 선택 해제
