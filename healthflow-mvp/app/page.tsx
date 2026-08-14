import { redirect } from 'next/navigation';
import { defaultLocale } from '@/lib/i18n';

// 미들웨어가 어떤 이유로든 리다이렉트를 못 하는 경우를 대비한 안전장치.
// "/"로 들어오면 무조건 기본 언어 경로로 보낸다.
export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
