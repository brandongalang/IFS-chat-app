'use client'

import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { isNewUIEnabled } from '@/config/features'

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
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col">
      {/* Top App Bar */}
      <header className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-10">
        <div className="flex size-12 shrink-0 items-center">
          {/* Placeholder for potential menu icon */}
        </div>
        <h1 className="text-text-primary-light dark:text-text-primary-dark text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
          Settings
        </h1>
        <div className="flex w-12 items-center justify-end">
          <button className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 w-10 bg-transparent text-text-primary-light dark:text-text-primary-dark">
            <MaterialIcon name="more_vert" className="text-2xl" />
          </button>
        </div>
      </header>

      {/* Settings Content */}
      <main className="flex-1 p-4 pb-24 space-y-4">
        <div className="rounded-xl bg-white dark:bg-[#1C1C1E] p-4 shadow-subtle">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-4">
            ACCOUNT
          </h2>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-100/60 dark:hover:bg-gray-700/40 transition-colors">
              <span className="text-text-primary-light dark:text-text-primary-dark text-base font-medium">
                Profile
              </span>
              <MaterialIcon name="chevron_right" className="text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-100/60 dark:hover:bg-gray-700/40 transition-colors">
              <span className="text-text-primary-light dark:text-text-primary-dark text-base font-medium">
                Notifications
              </span>
              <MaterialIcon name="chevron_right" className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#1C1C1E] p-4 shadow-subtle">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-4">
            PREFERENCES
          </h2>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-100/60 dark:hover:bg-gray-700/40 transition-colors">
              <span className="text-text-primary-light dark:text-text-primary-dark text-base font-medium">
                Theme
              </span>
              <MaterialIcon name="chevron_right" className="text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-100/60 dark:hover:bg-gray-700/40 transition-colors">
              <span className="text-text-primary-light dark:text-text-primary-dark text-base font-medium">
                Language
              </span>
              <MaterialIcon name="chevron_right" className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#1C1C1E] p-4 shadow-subtle">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-4">
            ABOUT
          </h2>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-100/60 dark:hover:bg-gray-700/40 transition-colors">
              <span className="text-text-primary-light dark:text-text-primary-dark text-base font-medium">
                Help & Support
              </span>
              <MaterialIcon name="chevron_right" className="text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-100/60 dark:hover:bg-gray-700/40 transition-colors">
              <span className="text-text-primary-light dark:text-text-primary-dark text-base font-medium">
                Privacy Policy
              </span>
              <MaterialIcon name="chevron_right" className="text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-100/60 dark:hover:bg-gray-700/40 transition-colors">
              <span className="text-text-primary-light dark:text-text-primary-dark text-base font-medium">
                Terms of Service
              </span>
              <MaterialIcon name="chevron_right" className="text-gray-400" />
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
