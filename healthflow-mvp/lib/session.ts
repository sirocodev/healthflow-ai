/**
 * 익명 세션 토큰 발급/검증
 *
 * 왜 필요한가:
 * 로그인이 없으므로 "누가 이 데이터의 주인인가"를 증명할 방법이 필요하다.
 * session_id를 클라이언트가 body/query로 그냥 보내게 하면,
 * UUID를 추측하거나 유출된 값으로 남의 건강 데이터에 접근하는 IDOR 취약점이 생긴다.
 *
 * 해결: 서버가 session_id를 발급할 때 HMAC 서명을 붙인 값을
 * HttpOnly + Secure + SameSite=Lax 쿠키로만 내려준다.
 * 이후 모든 요청은 이 쿠키를 검증해서 session_id를 얻는다 — 클라이언트가 보낸
 * session_id 파라미터는 절대 신뢰하지 않는다.
 */

import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'hf_session';
const SECRET = process.env.SESSION_SIGNING_SECRET!; // .env에만, 절대 클라이언트 번들에 포함 금지

function sign(sessionId: string): string {
  const mac = createHmac('sha256', SECRET).update(sessionId).digest('hex');
  return `${sessionId}.${mac}`;
}

function verify(token: string): string | null {
  const [sessionId, mac] = token.split('.');
  if (!sessionId || !mac) return null;
  const expected = createHmac('sha256', SECRET).update(sessionId).digest('hex');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return sessionId;
}

/** 신규 방문자용 세션 발급. 쿠키에 서명된 토큰을 심는다. */
export function issueSession(retentionDays: 1 | 7 | 30 = 7): string {
  const sessionId = randomUUID();
  const token = sign(sessionId);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: retentionDays * 24 * 60 * 60,
    path: '/',
  });
  return sessionId;
}

/** 기존 요청에서 세션을 검증해 session_id를 반환. 없거나 위조되면 null. */
export function getVerifiedSessionId(): string | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verify(token);
}

/** 사용자가 명시적으로 "내 데이터 삭제"를 눌렀을 때 */
export function clearSession(): void {
  cookies().delete(COOKIE_NAME);
}
