/**
 * HealthFlow AI — 결정론적 건강 계산 로직
 *
 * 설계 원칙 (기획안 10번): "LLM에게 모든 판단을 맡기지 않는다."
 * 생리주기 계산, 바이오리듬 계산은 순수 함수로 처리하고,
 * LLM은 이 결과를 "설명/제안하는" 역할만 맡는다.
 */

// ── 1) 생리주기 계산 ────────────────────────────────────────────────

export interface CycleInput {
  /** 최근 생리 시작일들 (최신순 정렬 불필요, 내부에서 정렬함) */
  pastStartDates: string[]; // 'YYYY-MM-DD'
  /** 사용자가 직접 입력한 평균 주기 길이(일). 없으면 기록에서 추정 */
  manualCycleLength?: number;
}

export interface CycleStatus {
  currentDay: number | null; // 현재 주기의 며칠째인지 (Day 1 = 시작일)
  cycleLength: number | null; // 추정 평균 주기 길이
  nextPredictedStart: string | null; // 'YYYY-MM-DD'
  phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'unknown';
  daysUntilNextPeriod: number | null;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

/** 최근 시작일들의 간격 평균으로 주기 길이를 추정한다. 데이터가 1개 이하면 null. */
function estimateCycleLength(sortedStarts: Date[]): number | null {
  if (sortedStarts.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < sortedStarts.length; i++) {
    gaps.push(diffDays(sortedStarts[i], sortedStarts[i - 1]));
  }
  // 이상치(너무 짧거나 긴 간격, 예: 오기입) 제거를 위해 15~45일 범위만 사용
  const valid = gaps.filter((g) => g >= 15 && g <= 45);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export function calculateCycleStatus(input: CycleInput, today: Date = new Date()): CycleStatus {
  if (!input.pastStartDates.length) {
    return {
      currentDay: null,
      cycleLength: null,
      nextPredictedStart: null,
      phase: 'unknown',
      daysUntilNextPeriod: null,
    };
  }

  const sortedStarts = [...input.pastStartDates]
    .map((d) => new Date(d + 'T00:00:00'))
    .sort((a, b) => a.getTime() - b.getTime());

  const lastStart = sortedStarts[sortedStarts.length - 1];
  const cycleLength = input.manualCycleLength ?? estimateCycleLength(sortedStarts) ?? 28; // 28일: 통계적 평균 fallback

  const currentDay = diffDays(today, lastStart) + 1;
  const nextPredicted = new Date(lastStart.getTime() + cycleLength * DAY_MS);
  const daysUntilNextPeriod = diffDays(nextPredicted, today);

  let phase: CycleStatus['phase'] = 'unknown';
  if (currentDay >= 1 && currentDay <= 5) phase = 'menstrual';
  else if (currentDay > 5 && currentDay <= cycleLength / 2 - 2) phase = 'follicular';
  else if (currentDay > cycleLength / 2 - 2 && currentDay <= cycleLength / 2 + 2) phase = 'ovulation';
  else if (currentDay > cycleLength / 2 + 2 && currentDay <= cycleLength) phase = 'luteal';

  return {
    currentDay,
    cycleLength,
    nextPredictedStart: nextPredicted.toISOString().slice(0, 10),
    phase,
    daysUntilNextPeriod,
  };
}

// ── 2) 바이오리듬 계산 (참고용 자기관리 지표 — 기획안 6번 확장안) ──────
// ⚠️ 과학적으로 검증된 건강 예측 모델이 아니므로, AI Insight에서는
//    실제 건강 데이터(수면/피로/스트레스) 대비 가중치를 낮게 두어야 한다.
//    UI에도 반드시 "참고용" 라벨을 노출한다.

export interface BiorhythmResult {
  physical: number; // -100 ~ 100
  emotional: number;
  intellectual: number;
}

const CYCLES = { physical: 23, emotional: 28, intellectual: 33 };

export function calculateBiorhythm(birthDate: string, today: Date = new Date()): BiorhythmResult {
  const birth = new Date(birthDate + 'T00:00:00');
  const daysAlive = diffDays(today, birth);

  const wave = (period: number) => Math.round(Math.sin((2 * Math.PI * daysAlive) / period) * 100);

  return {
    physical: wave(CYCLES.physical),
    emotional: wave(CYCLES.emotional),
    intellectual: wave(CYCLES.intellectual),
  };
}

// ── 3) 오늘의 컨디션 스코어 (규칙 기반 — AI 추천 이전 단계) ────────────
// 실제 건강 데이터에 압도적 가중치, 바이오리듬은 보조 지표로만 소폭 반영.

export interface ConditionInput {
  sleepHours?: number;
  sleepQuality?: number; // 1-5
  fatigue?: number; // 1-5, 높을수록 피곤
  stress?: number; // 1-5, 높을수록 스트레스
  cyclePhase?: CycleStatus['phase'];
  biorhythm?: BiorhythmResult;
}

export interface ConditionScore {
  overall: number; // 0-100
  focusReadiness: number; // 0-100
  exerciseReadiness: number; // 0-100
  restNeed: number; // 0-100
}

export function calculateConditionScore(input: ConditionInput): ConditionScore {
  // 결측치는 중간값(3)으로 보수적 처리
  const sleepScore = input.sleepHours != null ? Math.min(100, (input.sleepHours / 8) * 100) : 60;
  const qualityScore = ((input.sleepQuality ?? 3) / 5) * 100;
  const fatigueScore = 100 - ((input.fatigue ?? 3) / 5) * 100;
  const stressScore = 100 - ((input.stress ?? 3) / 5) * 100;

  // 생리 주기 단계별 보정 (황체기/생리기는 휴식 필요도 가중)
  const phasePenalty = input.cyclePhase === 'menstrual' || input.cyclePhase === 'luteal' ? 10 : 0;

  // 바이오리듬은 최대 ±5점만 영향 (참고용이므로 가중치 낮게)
  const biorhythmNudge = input.biorhythm
    ? (input.biorhythm.physical + input.biorhythm.intellectual) / 2 / 20
    : 0;

  const base = sleepScore * 0.35 + qualityScore * 0.15 + fatigueScore * 0.3 + stressScore * 0.2;
  const overall = clamp(base - phasePenalty + biorhythmNudge, 0, 100);

  const focusReadiness = clamp(
    (input.biorhythm?.intellectual ?? 0) / 2 + fatigueScore * 0.4 + qualityScore * 0.3,
    0,
    100
  );
  const exerciseReadiness = clamp(
    (input.biorhythm?.physical ?? 0) / 2 + fatigueScore * 0.5 - phasePenalty,
    0,
    100
  );
  const restNeed = clamp(100 - overall + phasePenalty, 0, 100);

  return {
    overall: Math.round(overall),
    focusReadiness: Math.round(focusReadiness),
    exerciseReadiness: Math.round(exerciseReadiness),
    restNeed: Math.round(restNeed),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
