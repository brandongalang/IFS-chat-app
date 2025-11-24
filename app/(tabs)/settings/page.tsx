'use client'

import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { isNewUIEnabled } from '@/config/features'
import Link from 'next/link'

export default function SettingsPage() {
  const newUI = isNewUIEnabled()

  if (!newUI) {
    // Settings page only available in new UI
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Settings coming soon</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--hs-bg)] flex flex-col hs-animate-in">
      {/* Header */}
      <header className="pt-12 pb-6 px-5">
        <h1 className="text-[28px] font-bold text-[var(--hs-text-primary)] leading-tight">
          Settings
        </h1>
      </header>

      {/* Settings Content */}
      <main className="flex-1 px-5 pb-24 space-y-6">
        {/* Account Section */}
        <section className="hs-card p-5">
          <h2 className="hs-section-title mb-4">Account</h2>
          <div className="space-y-1">
            <SettingsItem
              icon="person"
              label="Profile"
              href="/profile"
            />
            <SettingsItem
              icon="notifications"
              label="Notifications"
              href="/settings/notifications"
              comingSoon
            />
          </div>
        </section>

        {/* Preferences Section */}
        <section className="hs-card p-5">
          <h2 className="hs-section-title mb-4">Preferences</h2>
          <div className="space-y-1">
            <SettingsItem
              icon="palette"
              label="Theme"
              href="/settings/theme"
              comingSoon
            />
            <SettingsItem
              icon="schedule"
              label="Check-in Reminders"
              href="/settings/reminders"
              comingSoon
            />
          </div>
        </section>

        {/* About Section */}
        <section className="hs-card p-5">
          <h2 className="hs-section-title mb-4">About</h2>
          <div className="space-y-1">
            <SettingsItem
              icon="help"
              label="Help & Support"
              href="/settings/help"
              comingSoon
            />
            <SettingsItem
              icon="shield"
              label="Privacy Policy"
              href="/settings/privacy"
              comingSoon
            />
            <SettingsItem
              icon="description"
              label="Terms of Service"
              href="/settings/terms"
              comingSoon
            />
          </div>
        </section>

        {/* Version info */}
        <div className="text-center pt-4">
          <p className="text-xs text-[var(--hs-text-tertiary)]">
            Version 1.0.0
          </p>
        </div>
      </main>
    </div>
  )
}

interface SettingsItemProps {
  icon: string
  label: string
  href: string
  comingSoon?: boolean
}

function SettingsItem({ icon, label, href, comingSoon }: SettingsItemProps) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--hs-surface)] flex items-center justify-center">
          <MaterialIcon
            name={icon}
            className="text-lg text-[var(--hs-text-secondary)]"
          />
        </div>
        <span className="text-[var(--hs-text-primary)] text-base font-medium">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {comingSoon && (
          <span className="hs-chip text-[10px]">Soon</span>
        )}
        <MaterialIcon
          name="chevron_right"
          className="text-[var(--hs-text-tertiary)]"
        />
      </div>
    </>
  )

  if (comingSoon) {
    return (
      <div className="flex items-center justify-between p-3 rounded-xl opacity-60 cursor-not-allowed">
        {content}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--hs-surface)] transition-colors"
    >
      {content}
    </Link>
  )
}
