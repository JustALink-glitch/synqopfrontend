import { AlertBanner } from '@/components/ui/AlertBanner'
import { formatDayWithYear } from '@/lib/format'
import clsx from 'clsx'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { FileViewerHost } from '@/components/files/FileViewer'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import logo from '@/assets/synqop-logo.svg'
import mark from '@/assets/synqop-mark.svg'
import { navFor, type NavItem } from '@/app/navigation'
import { useAttentionCount } from '@/pages/admin/attention/data'
import { useAuth, type Me } from '@/auth/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { OfflineBanner } from '@/components/SystemPages'
import { ChevronDownIcon, CloseIcon, MenuIcon, SearchIcon, SettingsIcon, SignOutIcon, UserIcon } from '@/components/ui/icons'
import { initials, roleLabel, shortName } from '@/lib/people'
import { NotificationsBell } from '@/pages/shell/Notifications'
import { GlobalSearch } from '@/pages/shell/Search'
import { useUnreadAnnouncements } from '@/pages/announcements/data'
import type { Area } from '@/lib/roles'

const WORKSPACE_LABEL: Record<Area, string> = {
  admin: 'Programme team',
  trainer: 'Trainer workspace',
  participant: 'Participant',
}

/**
 * App shell (G1): sidebar + top bar.
 * ≥1280 full sidebar · 768–1279 icon rail · <768 mobile top bar with a navigation drawer (G1.05).
 */
export function AppShell({ area }: { area: Area }) {
  const { state } = useAuth()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerPath, setDrawerPath] = useState(location.pathname)

  // Close the drawer when a link in it navigates.
  if (drawerOpen && drawerPath !== location.pathname) {
    setDrawerPath(location.pathname)
    setDrawerOpen(false)
  }

  if (state.status !== 'signed-in') return null
  const { me } = state
  const items = navFor(area, me.membership.role)

  return (
    <div className="flex min-h-dvh bg-canvas">
      <aside className="sticky top-0 flex h-dvh w-sidebar shrink-0 flex-col gap-5 border-r border-default bg-surface px-4 pt-5 pb-4 max-md:hidden rail:items-center rail:px-3">
        <div className="flex items-center justify-between gap-2 rail:justify-center">
          <Link to={`/${area}`} className="rounded-md px-2 py-1 rail:hidden" aria-label="Synqop home">
            <img src={logo} alt="Synqop" width={120} height={26} className="h-[26px] w-auto" />
          </Link>
          <RailToggle home={`/${area}`} />
        </div>
        <OrganisationLabel me={me} area={area} />
        <SidebarNav area={area} items={items} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar me={me} area={area} />
        <MobileTopBar
          me={me}
          area={area}
          onMenu={() => {
            setDrawerPath(location.pathname)
            setDrawerOpen(true)
          }}
        />
        <main className="flex flex-1 flex-col gap-4 px-gutter pt-5 pb-12 max-md:pb-6">
          {me.organisation?.deletionScheduledFor && !location.pathname.endsWith('/settings/privacy') && (
            <ClosingBanner name={me.organisation.name} on={me.organisation.deletionScheduledFor} timeZone={me.organisation.timeZone} staff={area === 'admin'} />
          )}
          <OfflineBanner timeZone={me.organisation?.timeZone} />
          <Outlet />
        </main>
      </div>

      <FileViewerHost />
      {drawerOpen && <NavigationDrawer me={me} area={area} items={items} onClose={() => setDrawerOpen(false)} />}
    </div>
  )
}

const RAIL_KEY = 'synqop:sidebar'

function readRail() {
  try {
    return localStorage.getItem(RAIL_KEY) === 'collapsed'
  } catch {
    return false
  }
}

/**
 * Collapse or open the sidebar on wide screens (pilot feedback, Nov 2026); remembered on this device.
 * Collapsed, the rail shows the Synqop mark, which turns into the open icon on hover. Below 1280px the
 * sidebar is always a rail and the mark goes home.
 */
function RailToggle({ home }: { home: string }) {
  const [collapsed, setCollapsed] = useState(readRail)
  useEffect(() => {
    document.documentElement.dataset.rail = collapsed ? 'on' : 'off'
    try {
      localStorage.setItem(RAIL_KEY, collapsed ? 'collapsed' : 'open')
    } catch {
      // Private windows: it just isn't remembered.
    }
  }, [collapsed])
  const button =
    'size-9 shrink-0 items-center justify-center rounded-md text-icon focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none'
  return (
    <>
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Open the menu"
          aria-expanded={false}
          title="Open the menu"
          className={clsx(button, 'group relative inline-flex hover:bg-surface-hover hover:text-primary max-xl:hidden')}
        >
          <img
            src={mark}
            alt=""
            aria-hidden="true"
            className="size-7 motion-safe:transition-[opacity,transform] motion-safe:duration-150 motion-safe:ease-out group-hover:scale-90 group-hover:opacity-0 group-focus-visible:scale-90 group-focus-visible:opacity-0"
          />
          <PanelLeftOpen
            aria-hidden
            className="absolute size-[18px] scale-90 opacity-0 motion-safe:transition-[opacity,transform] motion-safe:duration-150 motion-safe:ease-out group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse the menu"
          aria-expanded
          title="Collapse the menu"
          className={clsx(button, 'inline-flex hover:bg-surface-hover hover:text-primary max-xl:hidden')}
        >
          <PanelLeftClose className="size-[18px]" aria-hidden />
        </button>
      )}
      <Link to={home} aria-label="Synqop home" className={clsx(button, 'hidden max-xl:inline-flex')}>
        <img src={mark} alt="" aria-hidden="true" className="size-7" />
      </Link>
    </>
  )
}

function OrganisationLabel({ me, area, compact }: { me: Me; area: Area; compact?: boolean }) {
  const name = me.organisation?.name ?? ''
  return (
    <div className={clsx('flex h-[52px] items-center gap-3 rounded-md px-2', !compact && 'rail:px-0')} title={name}>
      {me.organisation?.logoUrl ? (
        <img src={me.organisation.logoUrl} alt="" aria-hidden="true" className="size-8 shrink-0 rounded-sm object-contain" />
      ) : (
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-brand text-caption-strong text-on-brand">
          {initials(name)}
        </span>
      )}
      <span className={clsx('flex min-w-0 flex-col', !compact && 'rail:sr-only')}>
        <span className="truncate text-body-emphasis text-primary">{name}</span>
        <span className="truncate text-caption text-secondary">{WORKSPACE_LABEL[area]}</span>
      </span>
    </div>
  )
}

function SidebarNav({ area, items, inDrawer }: { area: Area; items: NavItem[]; inDrawer?: boolean }) {
  const main = items.filter((item) => !item.bottom)
  const bottom = items.filter((item) => item.bottom)
  return (
    <nav aria-label="Main" className={clsx('flex flex-1 flex-col', !inDrawer && 'rail:w-full')}>
      <ul className="flex flex-col gap-0.5">
        {main.map((item) => (
          <li key={item.path}>
            <SidebarLink area={area} item={item} inDrawer={inDrawer} />
          </li>
        ))}
      </ul>
      <ul className="mt-auto flex flex-col gap-0.5 border-t border-default pt-3">
        {bottom.map((item) => (
          <li key={item.path}>
            <SidebarLink area={area} item={item} inDrawer={inDrawer} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function SidebarLink({ area, item, inDrawer }: { area: Area; item: NavItem; inDrawer?: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path ? `/${area}/${item.path}` : `/${area}`}
      end={!item.path}
      title={inDrawer ? undefined : item.label}
      className={({ isActive }) =>
        clsx(
          'relative flex items-center gap-3 rounded-md px-3 text-label-nav tracking-[-0.1px] transition-colors',
          'focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none',
          inDrawer ? 'h-11' : 'h-10 rail:justify-center rail:px-0',
          isActive ? 'bg-surface-selected text-brand-text' : 'text-secondary hover:bg-surface-hover hover:text-primary',
        )
      }
    >
      <Icon size={20} className="shrink-0" />
      <span className={clsx('truncate', !inDrawer && 'rail:sr-only')}>{item.label}</span>
      {area === 'admin' && item.path === 'needs-attention' && <AttentionCount hidden={!inDrawer} />}
      {item.path === 'announcements' && <AnnouncementCount collapsed={!inDrawer} />}
    </NavLink>
  )
}

/** Open Needs attention flags, next to the sidebar item (G1). */
function AttentionCount({ hidden }: { hidden: boolean }) {
  const { data } = useAttentionCount(true)
  if (!data?.count) return null
  return (
    <span
      className={clsx('ml-auto rounded-full bg-warning-bg px-2 text-caption-strong text-warning-fg tabular-nums', hidden && 'rail:hidden')}
      aria-label={`${data.count} need attention`}
    >
      {data.count}
    </span>
  )
}

/** New announcements, until they're marked read (G1.03). A dot when the sidebar is narrow. */
function AnnouncementCount({ collapsed }: { collapsed: boolean }) {
  const { data } = useUnreadAnnouncements()
  if (!data?.unread) return null
  return (
    <>
      <span
        className={clsx('ml-auto rounded-full bg-brand px-2 text-caption-strong text-on-brand tabular-nums', collapsed && 'rail:hidden')}
        aria-label={`${data.unread} new`}
      >
        {data.unread}
      </span>
      {collapsed && <span aria-hidden="true" className="absolute top-2 right-2 size-2 rounded-full bg-brand full:hidden" />}
    </>
  )
}

function TopBar({ me, area }: { me: Me; area: Area }) {
  return (
    <header className="sticky top-0 z-20 flex h-topbar items-center gap-3 border-b border-default bg-surface px-gutter max-md:hidden">
      <GlobalSearch area={area} />
      <div className="flex-1" />
      <NotificationsBell area={area} />
      <span aria-hidden="true" className="h-6 w-px bg-default" />
      <AccountMenu me={me} area={area} />
    </header>
  )
}

/** Account menu (G1.03). */
function AccountMenu({ me, area, compact = false }: { me: Me; area: Area; compact?: boolean }) {
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const name = me.membership.displayName || shortName(me.membership.firstName, me.membership.lastName)
  const role = roleLabel[me.membership.role]

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? `Account: ${name}` : undefined}
        onClick={() => setOpen((value) => !value)}
        className={
          compact
            ? 'inline-flex size-11 items-center justify-center rounded-md hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none'
            : 'flex items-center gap-3 rounded-md py-0.5 pr-1 pl-0.5 hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none'
        }
      >
        <Avatar size={32} src={me.membership.photoUrl} initials={initials(me.membership.firstName, me.membership.lastName)} />
        {!compact && (
          <>
            <span className="flex flex-col items-start text-left">
              <span className="text-body-strong text-primary">{name}</span>
              <span className="text-caption text-secondary">{role}</span>
            </span>
            <ChevronDownIcon size={16} className="text-icon" />
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute top-[calc(100%+8px)] right-0 z-30 w-[260px] max-w-[calc(100vw-16px)] rounded-lg border border-default bg-surface py-2 shadow-[var(--shadow-overlay)]"
        >
          <div className="flex flex-col gap-0.5 border-b border-default px-4 py-3">
            <span className="text-body-strong text-primary">{name}</span>
            <span className="text-caption break-words text-secondary">
              {me.user.email} · {role}
            </span>
          </div>
          <MenuLink to={area === 'admin' ? '/admin/settings/profile' : `/${area}/profile`} icon={<UserIcon size={16} />} onSelect={() => setOpen(false)}>
            Profile &amp; password
          </MenuLink>
          <MenuLink to={`/${area}/settings`} icon={<SettingsIcon size={16} />} onSelect={() => setOpen(false)}>
            Settings
          </MenuLink>
          <div className="border-t border-default">
            <button type="button" role="menuitem" onClick={signOut} className={menuItemClass}>
              <SignOutIcon size={16} className="text-icon" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const menuItemClass =
  'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-body text-primary hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none'

function MenuLink({ to, icon, onSelect, children }: { to: string; icon: ReactNode; onSelect: () => void; children: ReactNode }) {
  return (
    <Link to={to} role="menuitem" onClick={onSelect} className={menuItemClass}>
      <span className="text-icon">{icon}</span>
      {children}
    </Link>
  )
}

/** Phones: a dot on the menu button while there are new announcements. */
function MenuDot() {
  const { data } = useUnreadAnnouncements()
  return data?.unread ? (
    <span aria-hidden="true" className="absolute top-2.5 right-2.5 size-2 rounded-full bg-brand ring-2 ring-[var(--color-surface)]" />
  ) : null
}

function MobileTopBar({ me, area, onMenu }: { me: Me; area: Area; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-topbar items-center gap-1 border-b border-default bg-surface pr-2 pl-1 md:hidden">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onMenu}
        className="relative inline-flex size-11 items-center justify-center rounded-md text-icon hover:bg-surface-hover"
      >
        <MenuIcon size={22} />
        <MenuDot />
      </button>
      <Link to={`/${area}`} aria-label="Synqop home">
        <img src={logo} alt="Synqop" width={110} height={24} className="h-6 w-auto" />
      </Link>
      <div className="flex-1" />
      <Link to={`/${area}/search`} aria-label="Search" className="inline-flex size-11 items-center justify-center rounded-md text-icon hover:bg-surface-hover">
        <SearchIcon size={22} />
      </Link>
      <NotificationsBell area={area} size={44} />
      <AccountMenu me={me} area={area} compact />
    </header>
  )
}

/** G1.05 Navigation menu (mobile). */
function NavigationDrawer({ me, area, items, onClose }: { me: Me; area: Area; items: NavItem[]; onClose: () => void }) {
  const { signOut } = useAuth()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panel.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        tabIndex={-1}
        className="relative flex h-full w-[320px] max-w-[85vw] flex-col gap-4 bg-surface px-4 pt-3 pb-4 outline-none"
      >
        <div className="flex items-center justify-between">
          <img src={logo} alt="Synqop" width={110} height={24} className="h-6 w-auto" />
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-md text-icon hover:bg-surface-hover"
          >
            <CloseIcon size={22} />
          </button>
        </div>
        <OrganisationLabel me={me} area={area} compact />
        <SidebarNav area={area} items={items} inDrawer />
        <div className="flex items-center gap-3 border-t border-default pt-3">
          <Avatar size={32} src={me.membership.photoUrl} initials={initials(me.membership.firstName, me.membership.lastName)} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body-strong text-primary">
              {me.membership.displayName || shortName(me.membership.firstName, me.membership.lastName)}
            </span>
            <span className="truncate text-caption text-secondary">{me.user.email}</span>
          </span>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="inline-flex size-11 items-center justify-center rounded-md text-icon hover:bg-surface-hover"
          >
            <SignOutIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

/** F1.11b: everyone sees the workspace is read-only until it's deleted. */
function ClosingBanner({ name, on, timeZone, staff }: { name: string; on: string; timeZone: string; staff: boolean }) {
  return (
    <AlertBanner tone="error" title={`${name} will be deleted on ${formatDayWithYear(on, timeZone)}`}>
      {staff ? (
        <>
          The workspace is read-only until then. An owner can export data or cancel the deletion in{' '}
          <Link to="/admin/settings/privacy" className="underline">
            Data &amp; privacy
          </Link>
          .
        </>
      ) : (
        'Until then you can sign in to read and download your own records, but nothing can be changed.'
      )}
    </AlertBanner>
  )
}
