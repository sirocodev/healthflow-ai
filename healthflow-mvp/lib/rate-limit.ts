/**
 * 세션당 요청 제한. 지금은 in-memory Map이라 서버리스 인스턴스마다 카운트가
 * 따로 놀 수 있음 — 트래픽이 늘면 Upstash Redis 같은 공유 스토어로 바꿀 것.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}
