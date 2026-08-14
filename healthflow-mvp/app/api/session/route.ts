/**
 * POST /api/session — 첫 방문 시 익명 세션 발급
 * DELETE /api/session — "내 데이터 삭제" 버튼에서 호출, 세션+연쇄 데이터 전부 삭제
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase';
import { issueSession, getVerifiedSessionId, clearSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const existing = getVerifiedSessionId();
  if (existing) return NextResponse.json({ sessionId: existing, isNew: false });

  const { retentionDays } = await req.json().catch(() => ({ retentionDays: 7 }));
  const allowed = [1, 7, 30].includes(retentionDays) ? retentionDays : 7;

  const sessionId = issueSession(allowed);
  const supabase = getSupabaseServerClient();
  await supabase.from('anonymous_sessions').insert({
    id: sessionId,
    retention_days: allowed,
    expires_at: new Date(Date.now() + allowed * 24 * 60 * 60 * 1000).toISOString(),
  });

  return NextResponse.json({ sessionId, isNew: true });
}

export async function DELETE() {
  const sessionId = getVerifiedSessionId();
  if (!sessionId) return NextResponse.json({ error: 'no_session' }, { status: 401 });

  const supabase = getSupabaseServerClient();
  await supabase.from('anonymous_sessions').delete().eq('id', sessionId);
  clearSession();

  return NextResponse.json({ deleted: true });
}
