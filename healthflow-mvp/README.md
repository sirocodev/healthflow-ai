# HealthFlow AI

개인 건강·생리주기 데이터를 AI가 분석해서 Google Calendar 일정을 최적화하고,
Notion 위젯으로 오늘의 컨디션을 보여주는 개인 생산성 서비스.

로그인 없이 익명 세션 기반으로 동작하며(Privacy-first), 한국어/영어/일본어를 지원합니다.

## 폴더 구조

```
healthflow-mvp/
├── app/api/           # Next.js API Routes (세션 발급, AI 추천)
├── lib/                # 핵심 로직 (계산, 세션, i18n, supabase, llm)
├── sql/                # Supabase DB 스키마
├── widget/             # Notion 위젯 (독립 HTML)
├── SECURITY_REVIEW.md
└── PERFORMANCE_CHECKLIST.md
```

## 로컬에서 실행하기

1. `.env.example`을 복사해 `.env.local`로 만들고 실제 값 채우기
2. `npm install`
3. `npm run dev`

## DB 세팅

Supabase 프로젝트를 만든 뒤 `sql/001_schema.sql`을 SQL Editor에서 실행하세요.
