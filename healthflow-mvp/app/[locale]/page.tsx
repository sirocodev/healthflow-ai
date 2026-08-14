import { getDictionary, t } from '@/lib/i18n';
import { getVerifiedSessionId } from '@/lib/session';
import { getSupabaseServerClient } from '@/lib/supabase';
import {
  calculateConditionScore,
  calculateCycleStatus,
  calculateBiorhythm,
} from '@/lib/health-calculations';

// 오늘 탭은 개인화된 세션 데이터를 담고 있어 캐싱하지 않는다 (매 방문 최신 상태 필요).
export const dynamic = 'force-dynamic';

export default async function TodayPage({ params }: { params: { locale: string } }) {
  const dict = getDictionary(params.locale);
  const sessionId = getVerifiedSessionId();

  if (!sessionId) {
    return <EmptyState locale={params.locale} dict={dict} />;
  }

  const supabase = getSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: healthRecord }, { data: cycles }, { data: birthInfo }, { data: events }, { data: latestRec }] =
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
        .select('title, start_time, end_time')
        .eq('session_id', sessionId)
        .gte('start_time', `${today}T00:00:00`)
        .lte('start_time', `${today}T23:59:59`)
        .order('start_time', { ascending: true }),
      supabase
        .from('ai_recommendations')
        .select('recommendation')
        .eq('session_id', sessionId)
        .eq('date', today)
        .maybeSingle(),
    ]);

  const cycleStatus = calculateCycleStatus({ pastStartDates: (cycles ?? []).map((c) => c.start_date) });
  const biorhythm = birthInfo?.birth_date ? calculateBiorhythm(birthInfo.birth_date) : undefined;
  const score = calculateConditionScore({
    sleepHours: healthRecord?.sleep_hours ?? undefined,
    sleepQuality: healthRecord?.sleep_quality ?? undefined,
    fatigue: healthRecord?.fatigue ?? undefined,
    stress: healthRecord?.stress ?? undefined,
    cyclePhase: cycleStatus.phase,
    biorhythm,
  });

  const circumference = 2 * Math.PI * 42;
  const dash = (score.overall / 100) * circumference;

  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 2px' }}>
        {t(dict, 'today.greeting')}
      </p>
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '0 0 20px' }}>
        {new Date().toLocaleDateString(params.locale, { month: 'long', day: 'numeric', weekday: 'short' })}
      </p>

      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          marginBottom: 14,
        }}
      >
        <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
          <svg viewBox="0 0 100 100" width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--blush-soft)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--blush)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 24, lineHeight: 1 }}>{score.overall}</span>
            <span style={{ fontSize: 9, color: 'var(--ink-soft)' }}>/ 100</span>
          </div>
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '0 0 4px' }}>{t(dict, 'today.conditionLabel')}</p>
          <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0 }}>
            {t(dict, 'today.cycleLabel')} Day {cycleStatus.currentDay ?? '–'}
          </p>
        </div>
      </div>

      {biorhythm && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <MiniStat label="Physical" value={biorhythm.physical} color="var(--blush)" />
          <MiniStat label="Emotional" value={biorhythm.emotional} color="var(--lavender)" />
          <MiniStat label="Intellectual" value={biorhythm.intellectual} color="var(--sage)" />
        </div>
      )}

      <div
        style={{
          background: 'linear-gradient(135deg, var(--lavender-soft), var(--blush-soft))',
          borderRadius: 20,
          padding: '14px 16px',
          fontSize: 12.5,
          lineHeight: 1.6,
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9c8aa8', display: 'block', marginBottom: 6 }}>
          {t(dict, 'today.aiRecommendation')}
        </span>
        {latestRec?.recommendation ?? '오늘의 건강 데이터를 입력하면 AI 추천을 받을 수 있어요.'}
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: '16px 18px' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft)', margin: '0 0 10px' }}>
          {t(dict, 'today.todaySchedule')}
        </p>
        {events && events.length > 0 ? (
          events.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0', fontSize: 12.5 }}>
              <span style={{ color: 'var(--ink-soft)', width: 42 }}>{e.start_time.slice(11, 16)}</span>
              <span>{e.title}</span>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: 0 }}>
            아직 연결된 캘린더가 없어요. 설정에서 Google Calendar를 연결해보세요.
          </p>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '10px 12px', textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'var(--ink-soft)', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 500, color, margin: 0 }}>{value}%</p>
    </div>
  );
}

function EmptyState({ locale, dict }: { locale: string; dict: any }) {
  return (
    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 15, color: 'var(--ink)', marginBottom: 8 }}>{t(dict, 'today.greeting')} 👋</p>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 20 }}>
        건강 데이터를 입력하면 오늘의 컨디션을 볼 수 있어요.
      </p>
      <a
        href={`/${locale}/health`}
        style={{
          display: 'inline-block',
          background: 'var(--ink)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: 999,
          fontSize: 13,
          textDecoration: 'none',
        }}
      >
        시작하기
      </a>
    </div>
  );
}
