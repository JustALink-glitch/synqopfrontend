import clsx from 'clsx'
import type { ReactNode } from 'react'
import logo from '@/assets/synqop-logo.svg'
import { CheckIcon } from '@/components/ui/icons'

export interface OnboardingStep {
  label: string
  detail?: string
  state: 'complete' | 'current' | 'upcoming'
}

/**
 * Onboarding / Progress panel (Figma 47:1022) + main column.
 * Desktop: 400px panel on the left, 440px content column from 120px down.
 * Mobile: the panel collapses to the logo; its message is not repeated.
 */
export function OnboardingLayout({
  panelTitle,
  panelBody,
  steps,
  footer,
  contentWidth = 440,
  children,
}: {
  panelTitle: string
  panelBody: string
  steps?: OnboardingStep[]
  footer?: ReactNode
  contentWidth?: 440 | 480
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <aside className="sticky top-0 flex h-dvh w-[400px] shrink-0 flex-col gap-10 border-r border-default bg-surface-subtle p-10 max-lg:hidden">
        <img src={logo} alt="Synqop" width={138} height={30} className="h-[30px] w-auto self-start" />
        <div className="flex flex-col gap-2">
          <p className="text-heading-group text-primary">{panelTitle}</p>
          <p className="text-body-large text-secondary">{panelBody}</p>
        </div>
        {steps && (
          <ol className="flex flex-col gap-1" aria-label="Set-up progress">
            {steps.map((step, index) => (
              <Step key={step.label} number={index + 1} {...step} />
            ))}
          </ol>
        )}
        <div className="flex-1" />
        {footer && <p className="text-caption text-muted">{footer}</p>}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Onboarding / Mobile header: logo, step count and segmented progress. */}
        <header className="flex flex-col gap-3 border-b border-default bg-surface px-4 pt-4 pb-3 lg:hidden">
          <div className="flex items-center justify-between">
            <img src={logo} alt="Synqop" width={101} height={22} className="h-[22px] w-auto" />
            {steps && (
              <p className="text-body text-secondary">
                Step {Math.max(1, steps.findIndex((s) => s.state === 'current') + 1)} of {steps.length}
              </p>
            )}
          </div>
          {steps && (
            <div className="flex gap-1.5" aria-hidden="true">
              {steps.map((step) => (
                <span key={step.label} className={clsx('h-1 flex-1 rounded-full', step.state === 'upcoming' ? 'bg-chart-track' : 'bg-brand')} />
              ))}
            </div>
          )}
        </header>

        <main className="flex flex-1 flex-col items-center px-4 pt-[120px] pb-16 max-lg:pt-6">
        <div className="flex w-full flex-col gap-6" style={{ maxWidth: contentWidth }}>
          {children}
        </div>
        </main>
      </div>
    </div>
  )
}

/** Onboarding / Step (Figma 47:1021): Complete shows a check, Current is highlighted, Upcoming is muted. */
function Step({ number, label, detail, state }: OnboardingStep & { number: number }) {
  return (
    <li
      aria-current={state === 'current' ? 'step' : undefined}
      className={clsx(
        'flex h-10 items-center gap-3 rounded-md px-3 py-2.5',
        state === 'current' && 'border border-default bg-surface',
      )}
    >
      <span
        className={clsx(
          'flex size-6 shrink-0 items-center justify-center rounded-full text-caption-strong',
          state === 'complete' && 'bg-brand text-on-brand',
          state === 'current' && 'border-[1.5px] border-brand-border bg-brand-subtle text-brand-text',
          state === 'upcoming' && 'border-[1.5px] border-default bg-surface text-muted',
        )}
      >
        {state === 'complete' ? <CheckIcon size={14} /> : number}
        {state === 'complete' && <span className="sr-only">Done:</span>}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={state === 'upcoming' ? 'text-body text-secondary' : 'text-body-strong text-primary'}>{label}</span>
        {detail && <span className="text-caption text-muted">{detail}</span>}
      </span>
    </li>
  )
}

/** Page header: optional "Step 1 of 4" eyebrow, Title/Page, Body/Large description. */
export function OnboardingHeader({ eyebrow, title, description, compact }: {
  eyebrow?: string
  title: string
  description?: ReactNode
  /** T1/P1 screens use a Body/Default description 6px under the title. */
  compact?: boolean
}) {
  return (
    <header className={clsx('flex flex-col', compact ? 'gap-1.5' : 'gap-2')}>
      {/* On mobile the step count lives in the header instead. */}
      {eyebrow && <p className="text-caption-strong text-brand-text max-lg:hidden">{eyebrow}</p>}
      <h1 className="text-page-title text-primary">{title}</h1>
      {description && <p className={compact ? 'text-body text-secondary' : 'text-body-large text-secondary'}>{description}</p>}
    </header>
  )
}

/** Onboarding / Summary row (Figma 47:1080). Only show values that have been saved. */
export function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-default py-2.5 text-body">
      <dt className="w-40 shrink-0 text-secondary">{label}</dt>
      <dd className="min-w-0 flex-1 text-body-strong text-primary">{value}</dd>
    </div>
  )
}
