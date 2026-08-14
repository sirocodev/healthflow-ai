import { getVerifiedSessionId, issueSession } from './session';
import { getSupabaseServerClient } from './supabase';

/**
 * 검증된 세션이 있으면 그대로 반환하고, 없으면 새로 발급한다.
 * "로그인 없이 바로 쓰기 시작" UX를 위해 첫 데이터 입력 시점에 세션을 만든다 —
 * 방문만 하고 아무것도 입력 안 한 사람의 세션까지 미리 만들지 않아 DB 레코드를 최소화한다.
 *
 * 쿠키는 있는데 DB에 anonymous_sessions 행이 없는 경우(예: 이전 요청이 DB 오류로
 * 실패했던 경우)를 대비해, 기존 쿠키가 있어도 매번 upsert로 자가 복구한다.
 * ignoreDuplicates: true라서 이미 있는 세션의 만료일은 건드리지 않는다.
 */
export async function ensureSession(): Promise<string> {
  const supabase = getSupabaseServerClient();
  const existing = getVerifiedSessionId();

  if (existing) {
    await supabase.from('anonymous_sessions').upsert(
      {
        id: existing,
        retention_days: 7,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
    return existing;
  }

  const sessionId = issueSession(7); // 기본 보존기간 7일, 설정 탭에서 나중에 변경 가능
  await supabase.from('anonymous_sessions').insert({
    id: sessionId,
    retention_days: 7,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return sessionId;
}
