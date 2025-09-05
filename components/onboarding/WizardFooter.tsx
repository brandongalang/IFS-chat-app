"use client"

export function WizardFooter({
  saving,
  nextDisabled,
  onNext,
  nextLabel = 'Continue',
  totalQuestions,
  currentQuestionIndex,
}: {
  saving: boolean
  nextDisabled?: boolean
  onNext?: () => void
  nextLabel?: string
  totalQuestions: number
  currentQuestionIndex: number
}) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <div className="flex-1">
        <div className="text-xs text-muted-foreground" aria-live="polite">
          {saving ? 'Saving…' : 'Saved'}
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center gap-2">
        {Array.from({ length: totalQuestions }).map((_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full ${i === currentQuestionIndex ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>
      <div className="flex flex-1 items-center justify-end gap-3">
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
