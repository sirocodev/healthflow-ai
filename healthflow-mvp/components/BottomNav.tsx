'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { key: 'today', href: '', icon: '🏠', ready: true },
  { key: 'health', href: '/health', icon: '🌸', ready: true },
  { key: 'planner', href: '/planner', icon: '🤖', ready: false },
  { key: 'schedule', href: '/schedule', icon: '📅', ready: false },
  { key: 'settings', href: '/settings', icon: '⚙️', ready: true },
] as const;

export default function BottomNav({
  locale,
  labels,
}: {
  locale: string;
  labels: Record<string, string>;
}) {
  const pathname = usePathname();
  const rest = pathname.replace(`/${locale}`, '') || '/';
  const active = TABS.find((t) => (t.href || '/') === rest)?.key ?? 'today';

  return (
    <nav
      style={{
        position: 'sticky',
        bottom: 0,
        display: 'flex',
        justifyContent: 'space-around',
        background: 'var(--card)',
        borderTop: '1px solid var(--line)',
        padding: '10px 0 calc(10px + env(safe-area-inset-bottom))',
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const content = (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              fontSize: 10,
              color: isActive ? 'var(--ink)' : 'var(--ink-soft)',
              opacity: tab.ready ? 1 : 0.4,
            }}
          >
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            <span>{labels[tab.key]}</span>
          </div>
        );
        return tab.ready ? (
          <Link key={tab.key} href={`/${locale}${tab.href}`} style={{ textDecoration: 'none' }}>
            {content}
          </Link>
        ) : (
          <div key={tab.key} style={{ cursor: 'default' }}>
            {content}
          </div>
        );
      })}
    </nav>
  );
}
