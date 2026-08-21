import { requireUser } from '@/lib/auth';
import { getHistory } from '@/lib/account-data';
import {
  DeleteAccountForm,
  HistoryControls,
  PasswordForm,
  ProfileForm,
} from '@/components/account/SettingsForms';

export default async function SettingsPage() {
  const { user, profile } = await requireUser('/account/settings');
  const { total } = await getHistory(user.id, { page: 1, pageSize: 1 });

  return (
    <div className="space-y-5">
      <ProfileForm fullName={profile.full_name ?? ''} email={profile.email} />
      <PasswordForm />
      <HistoryControls runCount={total} />
      <DeleteAccountForm email={profile.email} />
    </div>
  );
}
