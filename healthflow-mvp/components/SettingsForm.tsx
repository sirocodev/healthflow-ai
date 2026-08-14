'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsForm({
  labels,
}: {
  labels: { birthDate: string };
}) {
  const router = useRouter();
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/birth-info')
      .then((r) => r.json())
      .then((d) => {
        if (d.birthDate) setBirthDate(d.birthDate);
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    if (!birthDate) {
      setError('생년월일을 선택해주세요.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/birth-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthDate }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ? `저장 실패: ${body.message}` : '저장에 실패했어요.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('네트워크 오류로 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '20px 18px' }}>
      <p style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft)', margin: '0 0 16px' }}>
        개인 설정
      </p>

      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: '16px 18px' }}>
        <p style={{ fontSize: 12, fontWeight: 500, margin: '0 0 4px' }}>{labels.birthDate}</p>
        <p style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '0 0 10px', lineHeight: 1.5 }}>
          오늘 탭의 바이오리듬 카드에 쓰여요. 참고용 자기관리 지표라 실제 컨디션 점수에는 소폭만 반영돼요.
        </p>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => {
            setBirthDate(e.target.value);
            setSaved(false);
          }}
          max={new Date().toISOString().slice(0, 10)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid var(--line)',
            marginBottom: 12,
          }}
        />
        {error && <p style={{ color: 'var(--danger)', fontSize: 12, margin: '0 0 10px' }}>{error}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            background: saving ? 'var(--ink-soft)' : 'var(--ink)',
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '12px 0',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {saving ? '저장 중…' : saved ? '저장됨 ✓' : '저장하기'}
        </button>
      </div>
    </div>
  );
}
