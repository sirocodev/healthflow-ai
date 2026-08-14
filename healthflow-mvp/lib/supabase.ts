/**
 * 서버 전용 Supabase 클라이언트 (service role).
 * 절대 클라이언트 컴포넌트나 'use client' 파일에서 import하지 말 것 —
 * service role 키가 번들에 섞여 들어가면 RLS가 통째로 무력화된다.
 */
import { createClient } from '@supabase/supabase-js';

let cached: ReturnType<typeof createClient> | null = null;

export function getSupabaseServerClient() {
  if (cached) return cached;
  cached = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false }, // 서버리스 함수에서 세션을 유지할 필요 없음 — 매 요청 새로 검증
  });
  return cached;
}
