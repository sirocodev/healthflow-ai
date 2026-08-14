'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Dict = {
  health: Record<string, string>;
};

export default function HealthForm({ dict, locale }: { dict: Dict; locale: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    sleepHours: '',
    sleepQuality: 3,
    fatigue: 3,
    stress: 3,
    exerciseMinutes: '',
    memo: '',
    cycleStartDate: '',
    cycleEndDate: '',
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // 클라이언트 측 최소 검증 — 서버에서 다시 검증되므로 여기선 UX용으로만
    const sleepHours = form.sleepHours ? Number(form.sleepHours) : undefined;
    if (sleepHours != null && (sleepHours < 0 || sleepHours > 24)) {
      setError('수면 시간은 0~24 사이로 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/health-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sleepHours,
          sleepQuality: form.sleepQuality,
          fatigue: form.fatigue,
          stress: form.stress,
          exerciseMinutes: form.exerciseMinutes ? Number(form.exerciseMinutes) : undefined,
          memo: form.memo || undefined,
          cycleStartDate: form.cycleStartDate || undefined,
          cycleEndDate: form.cycleEndDate || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ? `저장 실패: ${body.message}` : '저장에 실패했어요. 잠시 후 다시 시도해주세요.');
        return;
      }
      setSaved(true);
      router.refresh(); // 오늘 탭의 Server Component 데이터도 갱신되도록
    } catch {
      setError('네트워크 오류로 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: '20px 18px 100px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>{dict.health.disclaimer}</p>

      <Section title={dict.health.cycleStart}>
        <div style={{ display: 'flex', gap: 10 }}>
          <DateField label={dict.health.cycleStart} value={form.cycleStartDate} onChange={(v) => update('cycleStartDate', v)} />
          <DateField label={dict.health.cycleEnd} value={form.cycleEndDate} onChange={(v) => update('cycleEndDate', v)} />
        </div>
      </Section>

      <Section title={dict.health.sleepHours}>
        <input
          type="number"
          step="0.5"
          min="0"
          max="24"
          placeholder="예: 7"
          value={form.sleepHours}
          onChange={(e) => update('sleepHours', e.target.value)}
          style={inputStyle}
        />
      </Section>

      <SliderField label={dict.health.sleepQuality} value={form.sleepQuality} onChange={(v) => update('sleepQuality', v)} />
      <SliderField label={dict.health.fatigue} value={form.fatigue} onChange={(v) => update('fatigue', v)} />
      <SliderField label={dict.health.stress} value={form.stress} onChange={(v) => update('stress', v)} />

      <Section title={dict.health.exercise}>
        <input
          type="number"
          min="0"
          placeholder="분 단위, 예: 30"
          value={form.exerciseMinutes}
          onChange={(e) => update('exerciseMinutes', e.target.value)}
          style={inputStyle}
        />
      </Section>

      <Section title={dict.health.memo}>
        <textarea
          maxLength={500}
          rows={3}
          value={form.memo}
          onChange={(e) => update('memo', e.target.value)}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </Section>

      {error && <p style={{ color: 'var(--danger)', fontSize: 12.5, margin: 0 }}>{error}</p>}

      <button
        type="submit"
        disabled={saving}
        style={{
          background: saving ? 'var(--ink-soft)' : 'var(--ink)',
          color: '#fff',
          border: 'none',
          borderRadius: 999,
          padding: '13px 0',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {saving ? '저장 중…' : saved ? '저장됨 ✓' : '저장하기'}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--ink)', margin: '0 0 8px', fontWeight: 500 }}>{title}</p>
      {children}
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, flex: 1 }}
    />
  );
}

function SliderField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{value} / 5</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#c6b8f0' }}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-control, 12px)',
  border: '1px solid var(--line)',
  background: '#fff',
  color: 'var(--ink)',
};
