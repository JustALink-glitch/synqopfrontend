import { Megaphone } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import {
  BookOpenIcon,
  CalendarIcon,
  ChartIcon,
  CheckCircleIcon,
  ClipboardIcon,
  FileIcon,
  GridIcon,
  HomeIcon,
  InfoTriangleIcon,
  SettingsIcon,
  UserGroupIcon,
  UserIcon,
} from '@/components/ui/icons'
import type { Area, Role } from '@/lib/roles'

export type NavIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

export interface NavItem {
  label: string
  /** Path relative to the area root. Empty string is the area home. */
  path: string
  icon: NavIcon
  /** First Figma screen for this item, e.g. "O1.01". */
  screen: string
  /** Pinned to the bottom of the sidebar. */
  bottom?: boolean
  /** Roles that can't see this item. */
  hiddenFor?: Role[]
}

/** Sidebars from Development Reference V1 §04; icons from the G1 sidebar components. */
export const navigation: Record<Area, NavItem[]> = {
  admin: [
    { label: 'Overview', path: '', icon: HomeIcon, screen: 'O1.01' },
    { label: 'Programmes', path: 'programmes', icon: GridIcon, screen: 'A1' },
    { label: 'Cohorts', path: 'cohorts', icon: CalendarIcon, screen: 'A3' },
    { label: 'Participants', path: 'participants', icon: UserGroupIcon, screen: 'B1' },
    { label: 'Needs attention', path: 'needs-attention', icon: InfoTriangleIcon, screen: 'D1' },
    { label: 'Trainers', path: 'trainers', icon: UserIcon, screen: 'B2' },
    { label: 'Courses & sessions', path: 'courses', icon: BookOpenIcon, screen: 'A2 · C1' },
    { label: 'Announcements', path: 'announcements', icon: Megaphone, screen: 'G1.03' },
    { label: 'Reports', path: 'reports', icon: ChartIcon, screen: 'E1' },
    { label: 'Settings', path: 'settings', icon: SettingsIcon, screen: 'F1', bottom: true },
  ],
  trainer: [
    { label: 'Dashboard', path: '', icon: HomeIcon, screen: 'T2.01' },
    { label: 'My cohorts', path: 'cohorts', icon: CalendarIcon, screen: 'T3.04' },
    { label: 'Grade assignments', path: 'grading', icon: ClipboardIcon, screen: 'T6.01' },
    { label: 'My sessions', path: 'sessions', icon: BookOpenIcon, screen: 'T3.01' },
    { label: 'My participants', path: 'participants', icon: UserGroupIcon, screen: 'T7.01' },
    { label: 'Announcements', path: 'announcements', icon: Megaphone, screen: 'G1.03' },
    // Hidden for assistants by default; the org setting (F1.04) can switch it on later.
    { label: 'Session reports', path: 'reports', icon: FileIcon, screen: 'T5.03', hiddenFor: ['assistant_trainer'] },
    { label: 'Settings', path: 'settings', icon: SettingsIcon, screen: 'T9.01', bottom: true },
  ],
  participant: [
    { label: 'Dashboard', path: '', icon: HomeIcon, screen: 'P2.01' },
    { label: 'My courses', path: 'courses', icon: BookOpenIcon, screen: 'P3.01' },
    { label: 'Sessions', path: 'sessions', icon: CalendarIcon, screen: 'P4.01' },
    { label: 'Assignments', path: 'assignments', icon: ClipboardIcon, screen: 'P5.01' },
    { label: 'Grades & feedback', path: 'grades', icon: CheckCircleIcon, screen: 'P6.01' },
    { label: 'Announcements', path: 'announcements', icon: Megaphone, screen: 'G1.03' },
    { label: 'Settings', path: 'settings', icon: SettingsIcon, screen: 'P8.01', bottom: true },
  ],
}

export function navFor(area: Area, role: Role): NavItem[] {
  return navigation[area].filter((item) => !item.hiddenFor?.includes(role))
}
