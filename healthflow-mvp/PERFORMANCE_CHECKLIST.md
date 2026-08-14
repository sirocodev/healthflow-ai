# 퍼포먼스 체크리스트 (직접 실행 순서)

우선순위 = "MVP 단계에서 안 하면 바로 체감되는 문제" 순.

## 1순위 — 지금 바로

1. **Supabase 커넥션 풀링 모드 켜기**
   Supabase 대시보드 → Project Settings → Database → Connection Pooling에서
   `Transaction` 모드 pooler URI를 `SUPABASE_URL` 대신 사용. Next.js 서버리스 함수는
   요청마다 새 커넥션을 열기 때문에, 풀링 안 하면 동시 요청 몇 개만 와도 커넥션이 고갈됨.

2. **`purge_expired_sessions()`를 실제로 pg_cron에 등록**
   Supabase 대시보드 → Database → Cron Jobs → 매일 새벽에 실행되도록 등록.
   안 하면 만료된 세션 데이터가 계속 쌓여서 인덱스 스캔이 느려짐.

3. **오늘의 AI 추천 결과 캐싱**
   `/api/ai-recommendation`은 하루 한 번만 값이 바뀌는데 지금 구조는 호출할 때마다
   LLM을 다시 호출함. `ai_recommendations` 테이블에서 오늘 날짜 레코드가 이미 있으면
   그걸 반환하고, 없을 때만 LLM 호출하도록 라우트 앞단에 조회 분기 추가.
   (LLM 호출 비용도 줄고, 응답속도도 수백ms → 수십ms로 줄어듦)

## 2순위 — 홈 탭(🏠 오늘) 만들 때

4. **홈 화면은 Server Component로, 위젯류만 Client Component로 분리**
   오늘 탭은 정적인 정보가 대부분이라 서버에서 렌더링해서 내려주고,
   AI 플래너처럼 상호작용이 필요한 부분만 `'use client'`로 쪼갤 것.

5. **Notion 위젯은 정적 캐싱 (`revalidate`)**
   Notion embed는 매번 새로고침될 때마다 요청이 들어오므로,
   `export const revalidate = 60` (또는 원하는 초) 로 캐싱해서 매번 DB를 안 때리게 할 것.
   실시간성이 중요하지 않은 화면이라 캐싱 여유가 큼.

6. **바이오리듬/생리주기 계산은 클라이언트로 넘기지 말고 서버에서 끝내서 내려주기**
   `lib/health-calculations.ts`의 순수 함수들은 이미 그렇게 되어 있음 — 이 패턴을
   앞으로 만들 페이지에서도 유지할 것 (클라이언트에서 재계산하면 번들 크기만 늘어남).

## 3순위 — 배포 직전

7. **Vercel Analytics / Speed Insights 켜기**
   실제 사용자 기준 LCP/INP 수치를 봐야 다음에 뭘 최적화할지 알 수 있음. 감으로 최적화하지 말 것.

8. **`next build` 후 번들 사이즈 확인**
   `npx next build`의 First Load JS 크기를 보고, 300KB 넘는 페이지가 있으면
   무거운 라이브러리(차트 라이브러리 등)를 `next/dynamic`으로 지연 로드.

9. **이미지 있다면 `next/image`로 교체**
   지금 스캐폴드엔 이미지가 없지만, 온보딩/설정 화면에 아이콘·일러스트 넣을 때
   `<img>` 대신 `next/image` 쓰면 자동 최적화·lazy loading 받음.

10. **API 라우트 응답에 캐시 헤더 검토**
    개인화된 데이터(세션별)는 캐싱하면 안 되지만, i18n 딕셔너리처럼 정적인 응답은
    `Cache-Control: public, max-age=3600` 정도로 CDN 캐싱 가능.

## 굳이 지금 안 해도 되는 것

- Redis 기반 분산 레이트리밋: 트래픽이 인스턴스 여러 개로 분산될 만큼 커지기 전엔
  지금의 in-memory 방식으로 충분함. 포트폴리오 단계에서 미리 넣으면 오히려 복잡도만 늘어남.
- 마이크로서비스 분리(FastAPI 분석 서버): 기획안 8번에 언급됐지만, MVP 트래픽 수준에서는
  Next.js API Route로 충분. 실사용자가 늘어서 AI 분석이 병목이 될 때 분리해도 늦지 않음.
