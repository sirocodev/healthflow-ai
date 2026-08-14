# HealthFlow AI

개인 건강·생리주기 데이터를 AI가 분석해서, 컨디션에 맞는 일정을 추천하고
Notion 위젯으로 오늘의 상태를 한눈에 보여주는 개인 건강·생산성 서비스.

로그인 없이 **익명 세션 기반**으로 동작하는 Privacy-first 구조이며, 한국어/영어/일본어를 지원합니다.

> ⚠️ 의료 진단 서비스가 아닙니다. 자기관리(self-care) 목적의 참고용 데이터를 다룹니다.

---

## 주요 기능

- 🏠 **오늘** — 오늘의 컨디션 점수, 생리주기 상태, 바이오리듬, AI 추천 문구를 한 화면에서 확인
- 🌸 **건강** — 수면·피로·스트레스·생리주기·운동 데이터 입력
- ⚙️ **설정** — 생년월일 등 개인 설정 (바이오리듬 계산에 사용)
- 🤖 **AI 추천** — 규칙 기반 계산(생리주기, 컨디션 점수) + LLM(Claude)의 설명 문장 생성을 분리한 하이브리드 구조
- 📌 **Notion 위젯** — 오늘의 컨디션을 Notion에 임베드할 수 있는 독립 실행형 HTML 위젯

## 진행 중 / 예정

- 📅 자체 캘린더 탭 (투두리스트, 생리 디데이 위젯) — Google Calendar는 실시간 연동 대신 **내보내기/백업** 용도로 전환
- 🌤 AI 플래너 탭을 지역 기반 날씨·교통정보 요약으로 재설계
- ⚙️ 설정 탭 확장 — 데이터 삭제, 보존기간 선택, 생리주기/수면/운동 목표

---

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Backend | Next.js API Routes, Supabase (PostgreSQL) |
| AI | Anthropic API (Claude) |
| i18n | 자체 경량 딕셔너리 + 미들웨어 로케일 라우팅 (`/ko`, `/en`, `/ja`) |

## 아키텍처 원칙

1. **로그인 없음** — `anonymous_sessions` 테이블 + HMAC 서명된 HttpOnly 쿠키로 사용자 식별. 클라이언트가 보낸 session_id는 절대 신뢰하지 않음.
2. **DB는 서버에서만 접근** — `service_role` 키만 사용, `anon` 키는 RLS로 전면 차단.
3. **LLM은 설명만, 판단은 규칙 기반** — 생리주기 계산·컨디션 점수는 순수 함수로 처리, LLM은 결과를 자연어로 설명만 함.
4. **개인정보 최소 수집·분리 저장** — 피드백 이메일은 건강 데이터와 FK로 연결 안 함. 생년월일도 별도 테이블.
5. **보존기간 기반 자동 삭제** — 세션마다 만료일을 두고 `purge_expired_sessions()`로 자동 삭제 (pg_cron 등록 필요).

---

## 폴더 구조

healthflow-mvp/
├── app/
│ ├── [locale]/ # 로케일별 페이지 (오늘 / 건강 / 설정)
│ └── api/ # API Routes (세션, 건강기록, 생년월일, AI 추천)
├── components/ # BottomNav, HealthForm, SettingsForm 등
├── lib/ # 계산 로직, 세션, i18n, supabase, llm, 검증
├── sql/ # Supabase DB 스키마
├── widget/ # Notion 위젯 (독립 HTML, 목데이터)
├── middleware.ts # 로케일 자동 리다이렉트
├── SECURITY_REVIEW.md # 자체 취약점 점검 기록
└── PERFORMANCE_CHECKLIST.md # 성능 개선 체크리스트


---

## 로컬에서 실행하기

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

`http://localhost:3000/ko` 로 접속.

### 필요한 환경 변수 (`.env.local`)

| 변수 | 발급처 |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase 프로젝트 → Settings → API |
| `SESSION_SIGNING_SECRET` | 임의의 랜덤 문자열 (`openssl rand -hex 32`) |
| `ANTHROPIC_API_KEY` | console.anthropic.com |

## DB 세팅

1. Supabase 프로젝트 생성
2. SQL Editor에서 `sql/001_schema.sql` 실행
   - 테이블 생성 + RLS 활성화 + **service_role GRANT**까지 포함
   - (신규 Supabase 프로젝트는 자동 권한 부여가 안 될 수 있어, 이 GRANT 없으면 service_role로도 `permission denied` 발생 가능)
3. Table Editor에서 `health_records`, `anonymous_sessions` 등 테이블 생성 확인

---

## 보안 / 성능

`SECURITY_REVIEW.md`, `PERFORMANCE_CHECKLIST.md` 참고 — 자체 점검 내역과 실서비스 전환 시 챙겨야 할 항목(토큰 암호화, pg_cron 등록 등)을 정리해뒀습니다.

## 라이선스

포트폴리오 프로젝트입니다.
