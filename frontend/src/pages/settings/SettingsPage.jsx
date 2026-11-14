import { useState } from 'react';
import { Lock, SlidersHorizontal, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common/PageHeader';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { PreferencesTab } from '@/pages/settings/PreferencesTab';
import { ProfileTab } from '@/pages/settings/ProfileTab';
import { SecurityTab } from '@/pages/settings/SecurityTab';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('profile');

  return (
    <div>
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />

      <Tabs
        idPrefix="settings"
        ariaLabel={t('settings.tabsLabel')}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'profile', label: t('settings.profile'), icon: <User className="h-4 w-4" /> },
          { id: 'security', label: t('settings.security'), icon: <Lock className="h-4 w-4" /> },
          {
            id: 'preferences',
            label: t('settings.preferences'),
            icon: <SlidersHorizontal className="h-4 w-4" />,
          },
        ]}
      />

      <TabPanel idPrefix="settings" id="profile" value={tab}>
        <ProfileTab />
      </TabPanel>
      <TabPanel idPrefix="settings" id="security" value={tab}>
        <SecurityTab />
      </TabPanel>
      <TabPanel idPrefix="settings" id="preferences" value={tab}>
        <PreferencesTab />
      </TabPanel>
    </div>
  );
}
