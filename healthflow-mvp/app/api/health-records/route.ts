import { NextRequest, NextResponse } from 'next/server';
import { ensureSession } from '@/lib/ensure-session';
import { getVerifiedSessionId } from '@/lib/session';
import { getSupabaseServerClient } from '@/lib/supabase';
import { isRateLimited } from '@/lib/rate-limit';
import { healthRecordSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const sessionId = await ensureSession();

    if (isRateLimited(`health-records:${sessionId}`, 20, 60_000)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const parsed = healthRecordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { cycleStartDate, cycleEndDate, ...record } = parsed.data;
    const supabase = getSupabaseServerClient();
    const today = new Date().toISOString().slice(0, 10);

    // upsert: 오늘 이미 입력한 게 있으면 덮어쓰기 (하루 1레코드 원칙)
    const { error: healthError } = await supabase.from('health_records').upsert(
      {
        session_id: sessionId,
        date: today,
        sleep_hours: record.sleepHours,
        sleep_quality: record.sleepQuality,
        fatigue: record.fatigue,
        stress: record.stress,
        exercise_minutes: record.exerciseMinutes,
        memo: record.memo,
      },
      { onConflict: 'session_id,date' }
    );

    if (healthError) {
      console.error('[health-records] save failed:', healthError.message, healthError);
      return NextResponse.json({ error: 'save_failed', message: healthError.message }, { status: 500 });
    }

    if (cycleStartDate) {
      await supabase.from('menstrual_cycles').insert({
        session_id: sessionId,
        start_date: cycleStartDate,
        end_date: cycleEndDate ?? null,
      });
    }

    return NextResponse.json({ saved: true, sessionId });
  } catch (err) {
    // 여기로 떨어지면 대개 환경변수 누락(.env.local)이 원인 — 터미널에 그대로 찍히도록 함
    console.error('[health-records] unexpected error:', err);
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: 'unexpected_error', message }, { status: 500 });
  }
}

export async function GET() {
  const sessionId = getVerifiedSessionId();
  if (!sessionId) return NextResponse.json({ record: null });

  const supabase = getSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('health_records')
    .select('sleep_hours, sleep_quality, fatigue, stress, exercise_minutes, memo')
    .eq('session_id', sessionId)
    .eq('date', today)
    .maybeSingle();

  return NextResponse.json({ record: data ?? null });
}
