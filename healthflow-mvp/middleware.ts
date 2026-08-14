import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale, resolveLocaleFromHeader } from '@/lib/i18n';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const hasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
  if (hasLocale) return NextResponse.next();

  // 세션이 이미 있으면 브라우저 언어보다 이전에 선택한 언어를 우선한다 (쿠키에 저장 권장)
  const cookieLocale = req.cookies.get('hf_locale')?.value;
  const locale =
    cookieLocale && locales.includes(cookieLocale as any)
      ? cookieLocale
      : resolveLocaleFromHeader(req.headers.get('accept-language'));

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // API 라우트, 정적 파일, Notion 위젯 임베드 경로는 리다이렉트에서 제외
  matcher: ['/((?!api|_next|favicon.ico|widget|.*\\..*).*)'],
};
