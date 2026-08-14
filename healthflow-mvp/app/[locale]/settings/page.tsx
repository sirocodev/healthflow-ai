import { getDictionary } from '@/lib/i18n';
import SettingsForm from '@/components/SettingsForm';

export default function SettingsPage({ params }: { params: { locale: string } }) {
  const dict = getDictionary(params.locale);
  return <SettingsForm labels={{ birthDate: dict.settings.birthDate }} />;
}
