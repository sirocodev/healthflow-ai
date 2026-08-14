-- HealthFlow AI — 스키마 v2 (익명 세션 기반, 로그인 없음)
-- 변경 이유: 회원가입/로그인을 제거하고 "Privacy-first" 원칙으로 재설계.
-- auth.users에 의존하지 않으므로, RLS는 auth.uid() 대신
-- "anon key로는 아무것도 접근 불가 + 서버(API route)만 service role로 접근"
-- 방식으로 보안을 잡는다. 이게 익명 세션 구조에서 가장 안전한 기본값이다.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1) 익명 세션
--    session_id는 서버가 발급하고, 클라이언트에는 서명된 HttpOnly 쿠키로만 전달한다.
--    클라이언트가 session_id 자체를 body/query로 보내도 절대 신뢰하지 않는다 (IDOR 방지).
create table if not exists public.anonymous_sessions (
  id uuid primary key default uuid_generate_v4(),
  retention_days smallint not null default 7 check (retention_days in (1, 7, 30)),
  created_at timestamptz not null default now(),
  -- 이 세션이 소유한 데이터가 언제 자동 삭제되는지. 매 활동마다 갱신.
  expires_at timestamptz not null default (now() + interval '7 days')
);

-- 2) 건강 기록 — user_id 대신 session_id
create table if not exists public.health_records (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.anonymous_sessions(id) on delete cascade,
  date date not null,
  sleep_hours numeric(4,1) check (sleep_hours >= 0 and sleep_hours <= 24),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  fatigue smallint check (fatigue between 1 and 5),
  stress smallint check (stress between 1 and 5),
  exercise_minutes int check (exercise_minutes >= 0),
  memo text,
  created_at timestamptz not null default now(),
  unique (session_id, date)
);

-- 3) 생리주기 기록
create table if not exists public.menstrual_cycles (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.anonymous_sessions(id) on delete cascade,
  start_date date not null,
  end_date date,
  cycle_length int,
  created_at timestamptz not null default now()
);

-- 4) 바이오리듬 계산용 생년월일 — 건강 데이터와 별도 테이블로 분리
--    (한 레코드에 몰아넣지 않는 게 기획 의도의 핵심이므로 굳이 나눔)
create table if not exists public.birth_info (
  session_id uuid primary key references public.anonymous_sessions(id) on delete cascade,
  birth_date date not null,
  created_at timestamptz not null default now()
);

-- 5) 캘린더 이벤트 — Google OAuth 토큰은 여기 두지 않고 별도 테이블로 분리 + 암호화
create table if not exists public.calendar_events (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.anonymous_sessions(id) on delete cascade,
  google_event_id text,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  category text,
  created_at timestamptz not null default now()
);

-- 5-1) Google OAuth 토큰 (refresh token은 반드시 암호화된 값만 저장)
create table if not exists public.calendar_connections (
  session_id uuid primary key references public.anonymous_sessions(id) on delete cascade,
  encrypted_refresh_token text not null, -- pgcrypto pgp_sym_encrypt() 결과. 평문 저장 금지.
  granted_scopes text[] not null,
  connected_at timestamptz not null default now()
);

-- 6) AI 추천 로그
create table if not exists public.ai_recommendations (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.anonymous_sessions(id) on delete cascade,
  date date not null,
  recommendation text not null,
  reason text,
  confidence numeric(3,2) check (confidence between 0 and 1),
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

-- 7) 피드백 이메일 — 건강 데이터와 절대 연결하지 않는다 (FK 없음, 완전 분리)
create table if not exists public.feedback_contacts (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  created_at timestamptz not null default now()
);

-- ── 권한(GRANT): 최신 Supabase 프로젝트는 테이블 생성 시 자동으로
--    anon/authenticated/service_role에 권한을 부여하지 않는 경우가 있다
--    (2025년 이후 플랫폼 기본값 변경 — "노출은 명시적으로 opt-in"으로 바뀜).
--    RLS와 별개로 이 GRANT가 없으면 service_role조차 "permission denied"를 받는다.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;

-- ── RLS: anon key로는 전부 차단, 서버(API route)만 service role로 접근 ──
-- 익명 세션 구조에서는 auth.uid()가 없으므로, "클라이언트 직접 접근 자체를 막는" 것이
-- 가장 확실한 기본값이다. 세션 검증은 API route에서 서명된 쿠키로 수행한다.
alter table public.anonymous_sessions enable row level security;
alter table public.health_records enable row level security;
alter table public.menstrual_cycles enable row level security;
alter table public.birth_info enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.ai_recommendations enable row level security;
alter table public.feedback_contacts enable row level security;
-- 의도적으로 어떤 정책도 만들지 않음 = anon/authenticated 롤은 완전 차단.
-- service_role 키만 RLS를 우회해 접근 가능 (Next.js 서버에서만 사용, 클라이언트 번들에 절대 포함 금지).

-- ── 보존기간 지난 데이터 자동 삭제용 함수 (pg_cron으로 매일 실행 권장) ──
create or replace function public.purge_expired_sessions()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.anonymous_sessions where expires_at < now();
  -- 나머지 테이블은 on delete cascade로 함께 삭제됨
end;
$$;

-- 인덱스
create index if not exists idx_health_records_session_date on public.health_records(session_id, date);
create index if not exists idx_calendar_events_session_time on public.calendar_events(session_id, start_time);
create index if not exists idx_anonymous_sessions_expires on public.anonymous_sessions(expires_at);
