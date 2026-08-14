import ko from './messages/ko.json';
import en from './messages/en.json';
import ja from './messages/ja.json';

export const locales = ['ko', 'en', 'ja'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ko';

const dictionaries: Record<Locale, typeof ko> = { ko, en, ja };

export function getDictionary(locale: string): typeof ko {
  return dictionaries[(locale as Locale) in dictionaries ? (locale as Locale) : defaultLocale];
}

/**
 * 중첩 키를 "settings.googleCalendar" 형태로 조회하고,
 * {days} 같은 플레이스홀더를 값으로 치환한다.
 * 사용 예: t(dict, 'schedule.daysRemaining', { days: 5 })
 */
export function t(
  dict: Record<string, unknown>,
  key: string,
  vars?: Record<string, string | number>
): string {
  const value = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);

  if (typeof value !== 'string') return key; // 번역 누락 시 키를 그대로 노출해 눈에 띄게 함

  if (!vars) return value;
  return Object.entries(vars).reduce(
    (str, [k, v]) => str.replaceAll(`{${k}}`, String(v)),
    value
  );
}

/** Accept-Language 헤더에서 지원 로케일 중 가장 적합한 것을 고른다. */
export function resolveLocaleFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  const preferred = acceptLanguage.split(',').map((s) => s.split(';')[0].trim().slice(0, 2));
  for (const lang of preferred) {
    if (locales.includes(lang as Locale)) return lang as Locale;
  }
  return defaultLocale;
}
