import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useMatch } from 'react-router'
import { ChevronRightIcon } from '@/components/ui/icons'
import { PageHeader, Panel } from '@/components/ui/Page'
import { isWideScreen } from './screen'
import { settingsMenu } from './settingsMenu'

/** /admin/settings — F1 Settings frame: side menu on the left (stays put on desktop), the chosen page on the right. */
export function SettingsLayout() {
  // On phones and tablets the index (F1.00) is the menu, so the tab strip isn't shown there.
  const atIndex = Boolean(useMatch('/admin/settings'))
  return (
    <>
      <PageHeader title="Settings" description="Organisation-wide settings. Only Owners and Admins can see this area." />
      <div className="grid grid-cols-[216px_minmax(0,1fr)] items-start gap-6 max-lg:grid-cols-1 max-lg:gap-4">
        <nav
          aria-label="Settings"
          className={clsx(
            'flex flex-col gap-4 lg:sticky lg:top-[calc(var(--topbar-height)+20px)] lg:max-h-[calc(100dvh-var(--topbar-height)-40px)] lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:thin] max-lg:-mx-1 max-lg:flex-row max-lg:gap-1 max-lg:overflow-x-auto max-lg:px-1 max-lg:pb-1',
            atIndex && 'max-lg:hidden',
          )}
        >
          {settingsMenu.map((section) => (
            <div key={section.group} className="flex flex-col gap-0.5 max-lg:contents">
              <p className="px-2.5 pb-1 text-caption text-secondary max-lg:hidden">{section.group}</p>
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    clsx(
                      'flex h-9 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-body-strong whitespace-nowrap transition-colors focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none',
                      isActive ? 'bg-surface-selected text-brand-text' : 'text-secondary hover:bg-surface-hover hover:text-primary',
                    )
                  }
                >
                  <item.icon size={16} className="shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          <Outlet />
        </div>
      </div>
    </>
  )
}

/** F1.00 Settings index: the menu as cards on smaller screens; desktop opens Organisation details. */
export function SettingsIndex() {
  if (isWideScreen()) return <Navigate to="organisation" replace />
  return (
    <>
      {settingsMenu.map((section) => (
        <Panel key={section.group} aria-labelledby={`settings-${section.group}`} className="gap-0 py-2">
          <h2 id={`settings-${section.group}`} className="pt-2 pb-1 text-heading-section text-primary">
            {section.group}
          </h2>
          <ul className="flex flex-col">
            {section.items.map((item) => (
              <li key={item.path} className="border-b border-default last:border-b-0">
                <Link to={item.path} className="flex min-h-14 items-center gap-3 py-3 focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-body-strong text-primary">{item.label}</span>
                    <span className="text-caption text-secondary">{item.summary}</span>
                  </span>
                  <ChevronRightIcon size={16} className="shrink-0 text-icon" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </>
  )
}

export function SettingsTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-4 max-md:flex-col max-md:gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-heading-group text-primary">{title}</h2>
        {description && <p className="text-body text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  )
}
