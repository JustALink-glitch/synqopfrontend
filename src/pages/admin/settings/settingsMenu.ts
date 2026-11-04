import {
  BellIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClipboardIcon,
  FileIcon,
  GridIcon,
  HomeIcon,
  InfoTriangleIcon,
  LockIcon,
  UserGroupIcon,
  UserIcon,
} from '@/components/ui/icons'
import { History } from 'lucide-react'
import type { NavIcon } from '@/app/navigation'

type Item = { label: string; path: string; icon: NavIcon; screen: string; summary: string }

/** F1 side menu, in the order of the designs. */
export const settingsMenu: { group: string; items: Item[] }[] = [
  {
    group: 'Organisation',
    items: [
      { label: 'Organisation details', path: 'organisation', icon: HomeIcon, screen: 'F1.01', summary: 'Name, type, country, time zone' },
      { label: 'Members & roles', path: 'members', icon: UserGroupIcon, screen: 'F1.02', summary: 'Staff, roles and invitations' },
      { label: 'Plan & billing', path: 'billing', icon: FileIcon, screen: 'F1.03', summary: 'Free plan' },
      { label: 'Activity log', path: 'activity', icon: History as NavIcon, screen: 'F1.12', summary: 'Everything admins and trainers have done' },
      { label: 'Data & privacy', path: 'privacy', icon: LockIcon, screen: 'F1.10', summary: 'Export data or delete the organisation' },
    ],
  },
  {
    group: 'Programme rules',
    items: [
      { label: 'Programme setup', path: 'programme-setup', icon: GridIcon, screen: 'F1.04', summary: 'Courses, trainers, grading, feedback' },
      { label: 'Completion & certificates', path: 'completion', icon: CheckCircleIcon, screen: 'F1.05', summary: 'Criteria, certificates, outcomes' },
      { label: 'Needs attention rules', path: 'attention-rules', icon: InfoTriangleIcon, screen: 'F1.06', summary: 'Signals, who sees flags, closing them' },
      { label: 'Attendance & Zoom', path: 'attendance', icon: CalendarIcon, screen: 'F1.07', summary: 'Zoom, join links, recordings, in person' },
      { label: 'Session reports', path: 'session-reports', icon: ClipboardIcon, screen: 'F1.08', summary: 'Questions and due time' },
    ],
  },
  {
    group: 'Your account',
    items: [
      { label: 'Profile & password', path: 'profile', icon: UserIcon, screen: 'G1.04', summary: 'Name, phone and password' },
      { label: 'Notifications', path: 'notifications', icon: BellIcon, screen: 'F1.09', summary: 'Email and in-app alerts' },
    ],
  },
]
