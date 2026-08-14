/**
 * POST /api/ai-recommendation (익명 세션 버전, 리팩터링 후)
 * Supabase 클라이언트 / 레이트리밋 / LLM 호출은 lib/의 공통 모듈을 사용한다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionId } from '@/lib/session';
import { getSupabaseServerClient } from '@/lib/supabase';
import { isRateLimited } from '@/lib/rate-limit';
import { callClaude } from '@/lib/llm';
import {
  calculateConditionScore,
  calculateCycleStatus,
  calculateBiorhythm,
  type ConditionScore,
} from '@/lib/health-calculations';

const RATE_LIMIT = 5;
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const sessionId = getVerifiedSessionId();
  if (!sessionId) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  if (isRateLimited(`ai-recommendation:${sessionId}`, RATE_LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const supabase = getSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: healthRecord }, { data: cycles }, { data: birthInfo }, { data: todayEvents }] =
    await Promise.all([
      supabase
        .from('health_records')
        .select('sleep_hours, sleep_quality, fatigue, stress')
        .eq('session_id', sessionId)
        .eq('date', today)
        .maybeSingle(),
      supabase
        .from('menstrual_cycles')
        .select('start_date')
        .eq('session_id', sessionId)
        .order('start_date', { ascending: false })
        .limit(6),
      supabase.from('birth_info').select('birth_date').eq('session_id', sessionId).maybeSingle(),
      supabase
        .from('calendar_events')
        .select('title, start_time, end_time, category')
        .eq('session_id', sessionId)
        .gte('start_time', `${today}T00:00:00`)
        .lte('start_time', `${today}T23:59:59`)
        .order('start_time', { ascending: true }),
    ]);

  const cycleStatus = calculateCycleStatus({
    pastStartDates: (cycles ?? []).map((c) => c.start_date),
  });
  const biorhythm = birthInfo?.birth_date ? calculateBiorhythm(birthInfo.birth_date) : undefined;
  const conditionScore: ConditionScore = calculateConditionScore({
    sleepHours: healthRecord?.sleep_hours ?? undefined,
    sleepQuality: healthRecord?.sleep_quality ?? undefined,
    fatigue: healthRecord?.fatigue ?? undefined,
    stress: healthRecord?.stress ?? undefined,
    cyclePhase: cycleStatus.phase,
    biorhythm,
  });

  const prompt = buildPrompt(conditionScore, cycleStatus.phase, todayEvents ?? []);

  let recommendationText: string;
  try {
    recommendationText = await callClaude(prompt);
  } catch {
    recommendationText = '오늘의 데이터를 기반으로 무리하지 않는 일정을 추천드려요.';
  }

  await supabase.from('ai_recommendations').insert({
    session_id: sessionId,
    date: today,
    recommendation: recommendationText,
    reason: `overall=${conditionScore.overall}, phase=${cycleStatus.phase}`,
    confidence: 0.7,
    applied: false,
  });

  return NextResponse.json({ conditionScore, cycleStatus, recommendation: recommendationText });
}

function buildPrompt(
  score: ConditionScore,
  phase: string,
  events: { title: string; start_time: string; end_time: string; category: string | null }[]
): string {
  const eventSummary = events
    .map((e) => `- ${e.title} (${e.start_time.slice(11, 16)}~${e.end_time.slice(11, 16)}, ${e.category ?? '기타'})`)
    .join('\n');

  return `당신은 개인 건강/생산성 코치입니다. 아래 데이터를 바탕으로 오늘 일정 배치에 대한
2~3문장 한국어 제안을 작성하세요. 의료적 진단이나 단정적 건강 판단은 하지 마세요.

오늘의 컨디션 점수: 종합 ${score.overall}/100, 집중적합도 ${score.focusReadiness}, 운동적합도 ${score.exerciseReadiness}, 휴식필요도 ${score.restNeed}
생리주기 단계: ${phase}
오늘 일정:
${eventSummary || '(등록된 일정 없음)'}

출력은 사용자에게 바로 보여줄 자연스러운 문장으로만 작성하세요.`;
}
