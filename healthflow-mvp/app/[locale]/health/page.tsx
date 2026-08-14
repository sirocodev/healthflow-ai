import { getDictionary } from '@/lib/i18n';
import HealthForm from '@/components/HealthForm';

export default function HealthPage({ params }: { params: { locale: string } }) {
  const dict = getDictionary(params.locale);
  return <HealthForm dict={dict} locale={params.locale} />;
}
