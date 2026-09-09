import { PageHeader } from '@/components/page-ui'
import { SettingsForm } from '@/components/settings-form'
import { PasswordForm } from '@/components/password-form'
import { getFinderSettings, getPaymentSettings, getSetting } from '@/lib/settings'

export default async function AdminSettingsPage() {
  const [general, finder, payments, system] = await Promise.all([
    getSetting('general', { applicationName: 'Ghost Mail Finder', supportEmail: 'support@example.com' }),
    getFinderSettings(),
    getPaymentSettings(),
    getSetting('system', { maintenanceMode: false, registrationEnabled: true, searchQueueEnabled: true, notificationsEnabled: true }),
  ])
  return <div className="space-y-7"><PageHeader eyebrow="Administration" title="System settings" description="General, crawler, queue, registration, and crypto payment configuration. Wallet entries are public receiving addresses only." /><SettingsForm general={general} finder={finder} payments={payments} system={system} /><PasswordForm /></div>
}
