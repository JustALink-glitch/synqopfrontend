import clsx from 'clsx'
import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDownIcon, EyeIcon, EyeOffIcon, InfoCircleIcon } from './icons'

interface FieldChrome {
  label: string
  /** Shows "Optional" after the label. */
  optional?: boolean
  helper?: ReactNode
  /** Replaces the helper and turns the field red (Text field · Error). */
  error?: string | null
  /** Red border without a message — when the message belongs to another field. */
  invalid?: boolean
}

const controlClass = (hasError: boolean, disabled?: boolean) =>
  clsx(
    'h-9 w-full rounded-md border px-3 text-body outline-none transition-[border-color,box-shadow]',
    'placeholder:text-muted',
    disabled ? 'cursor-not-allowed border-default bg-surface-hover text-disabled' : 'bg-surface text-primary',
    !disabled && (hasError ? 'border-error' : 'border-strong focus:border-focus'),
    !disabled && 'focus:shadow-[var(--shadow-focus)]',
  )

function Chrome({
  id,
  label,
  optional,
  helper,
  error,
  disabled,
  children,
}: FieldChrome & {
  id: string
  disabled?: boolean | undefined
  children: ReactNode
}) {
  const describedBy = `${id}-help`
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={id} className="flex gap-1.5 text-caption-strong">
        <span className={disabled ? 'text-disabled' : 'text-primary'}>{label}</span>
        {optional && <span className="text-caption text-muted">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={describedBy} className="flex items-center gap-1 text-caption text-error-fg">
          <InfoCircleIcon size={14} className="shrink-0" />
          {error}
        </p>
      ) : helper ? (
        <p id={describedBy} className="text-caption text-secondary">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

/** Text field (Figma 11:92): label, optional marker, input, helper or error. */
export function TextField({
  label,
  optional,
  helper,
  error,
  invalid,
  id: idProp,
  disabled,
  className,
  ...input
}: FieldChrome & InputHTMLAttributes<HTMLInputElement>) {
  const generated = useId()
  const id = idProp ?? generated
  const [shown, setShown] = useState(false)
  if (input.type === 'password') {
    // Show/hide button on every password field (pilot feedback, Nov 2026).
    return (
      <Chrome id={id} label={label} optional={optional} helper={helper} error={error} disabled={disabled}>
        <div className="relative">
          <input
            id={id}
            disabled={disabled}
            aria-invalid={error || invalid ? true : undefined}
            aria-describedby={error || helper ? `${id}-help` : undefined}
            className={clsx(controlClass(Boolean(error) || Boolean(invalid), disabled), 'pr-10', className)}
            {...input}
            type={shown ? 'text' : 'password'}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            aria-controls={id}
            className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-md text-secondary hover:text-primary focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none disabled:cursor-not-allowed disabled:text-disabled"
          >
            {shown ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
          </button>
        </div>
      </Chrome>
    )
  }
  return (
    <Chrome id={id} label={label} optional={optional} helper={helper} error={error} disabled={disabled}>
      <input
        id={id}
        disabled={disabled}
        aria-invalid={error || invalid ? true : undefined}
        aria-describedby={error || helper ? `${id}-help` : undefined}
        className={clsx(controlClass(Boolean(error) || Boolean(invalid), disabled), className)}
        {...input}
      />
    </Chrome>
  )
}

/** Select (Figma 11:158): same chrome as Text field, with a chevron. */
export function SelectField({
  label,
  optional,
  helper,
  error,
  invalid: _invalid,
  id: idProp,
  disabled,
  children,
  ...select
}: FieldChrome & SelectHTMLAttributes<HTMLSelectElement>) {
  const generated = useId()
  const id = idProp ?? generated
  return (
    <Chrome id={id} label={label} optional={optional} helper={helper} error={error} disabled={disabled}>
      <div className="relative w-full">
        <select
          id={id}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? `${id}-help` : undefined}
          className={clsx(controlClass(Boolean(error), disabled), 'appearance-none pr-9')}
          {...select}
        >
          {children}
        </select>
        <ChevronDownIcon size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-icon" />
      </div>
    </Chrome>
  )
}

/** Multi-line text field (Description fields on A1.03, A2.03): 96px tall. */
export function TextAreaField({
  label,
  optional,
  helper,
  error,
  id: idProp,
  disabled,
  className,
  ...textarea
}: FieldChrome & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generated = useId()
  const id = idProp ?? generated
  return (
    <Chrome id={id} label={label} optional={optional} helper={helper} error={error} disabled={disabled}>
      <textarea
        id={id}
        disabled={disabled}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || helper ? `${id}-help` : undefined}
        className={clsx(controlClass(Boolean(error), disabled), 'h-24 resize-y py-2.5', className)}
        {...textarea}
      />
    </Chrome>
  )
}
