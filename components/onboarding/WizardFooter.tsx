"use client"

export function WizardFooter({
  saving,
  nextDisabled,
  onNext,
  nextLabel = 'Continue',
}: {
  saving: boolean
  nextDisabled?: boolean
  onNext?: () => void
  nextLabel?: string
}) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <div className="text-xs text-muted-foreground" aria-live="polite">
        {saving ? 'Saving…' : 'Saved'}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          disabled={nextDisabled}
          onClick={() => onNext?.()}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
