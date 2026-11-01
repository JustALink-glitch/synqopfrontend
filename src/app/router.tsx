import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { RequireArea } from '@/auth/RequireArea'
import { AppShell } from '@/components/shell/AppShell'
import { AdminAssignmentsPage } from '@/pages/assignments/AdminAssignmentsPage'
import { AssignmentFormPage } from '@/pages/assignments/AssignmentFormPage'
import { AssignmentPage } from '@/pages/assignments/AssignmentPage'
import { GradeScalesPage } from '@/pages/assignments/GradeScalesPage'
import { SubmissionPage } from '@/pages/assignments/SubmissionPage'
import { TrainerAssignmentsPage } from '@/pages/assignments/TrainerAssignmentsPage'
import { AdminCertificatePage } from '@/pages/admin/completion/CertificatePage'
import { CertificatesPage } from '@/pages/admin/completion/CertificatesPage'
import { OutcomesPage } from '@/pages/admin/completion/OutcomesPage'
import { AttendanceSettingsPage } from '@/pages/admin/settings/AttendanceSettingsPage'
import { AttentionRulesPage } from '@/pages/admin/settings/AttentionRulesPage'
import { CompletionSettingsPage } from '@/pages/admin/settings/CompletionSettingsPage'
import { MembersSettingsPage } from '@/pages/admin/settings/MembersSettingsPage'
import { NotificationSettingsPage } from '@/pages/admin/settings/NotificationSettingsPage'
import { OrganisationSettingsPage } from '@/pages/admin/settings/OrganisationSettingsPage'
import { ProfileSettingsPage } from '@/pages/admin/settings/ProfileSettingsPage'
import { ProgrammeSetupPage } from '@/pages/admin/settings/ProgrammeSetupPage'
import { SessionReportSettingsPage } from '@/pages/admin/settings/SessionReportSettingsPage'
import { SessionReportPage } from '@/pages/reports/SessionReportPage'
import { SessionReportsPage } from '@/pages/reports/SessionReportsPage'
import { AdminOnlyPage, TodayPage } from '@/pages/trainer/TodayPage'
import { SettingsIndex, SettingsLayout } from '@/pages/admin/settings/SettingsLayout'
import { BillingPage } from '@/pages/admin/settings/BillingPage'
import { PrivacyPage } from '@/pages/admin/settings/PrivacyPage'
import { MyCertificatePage, ProgressPage } from '@/pages/participant/ProgressPage'
import { OverviewPage } from '@/pages/admin/overview/OverviewPage'
import { ReportsPage } from '@/pages/admin/reports/ReportsPage'
import { InterventionsPage, NeedsAttentionPage } from '@/pages/admin/attention/NeedsAttentionPage'
import { SessionFeedbackPage } from '@/pages/feedback/SessionFeedbackPage'
import { MyCohortCourses, MyCohortLayout, MyCohortOverview, MyCohortParticipants, MyCohortSessions, MyCohortsPage } from '@/pages/trainer/MyCohortsPage'
import { MyParticipantsPage, TrainerParticipantPage } from '@/pages/trainer/MyParticipantsPage'
import { MySessionsPage as TrainerSessionsPage } from '@/pages/trainer/MySessionsPage'
import { DashboardPage } from '@/pages/participant/DashboardPage'
import { FeedbackPage, GradesPage } from '@/pages/participant/GradesPage'
import { CoursePage, MyCoursesPage } from '@/pages/participant/MyCoursesPage'
import { MySessionPage, MySessionsPage } from '@/pages/participant/MySessionsPage'
import { SettingsPage } from '@/pages/participant/SettingsPage'
import { AccountSettingsPage } from '@/pages/shell/AccountSettingsPage'
import { WelcomePage, WelcomeProfilePage } from '@/pages/onboarding/WelcomePages'
import { NotFoundPage, RootNotFound, ServerErrorPage, SignedOutPage } from '@/components/SystemPages'
import { ZoomMatchPage } from '@/pages/admin/sessions/ZoomMatchPage'
import { CourseDetailPage } from '@/pages/admin/programmes/CourseDetailPage'
import { EditCoursePage } from '@/pages/admin/programmes/EditCoursePage'
import { NotificationsPage } from '@/pages/shell/Notifications'
import { SearchPage } from '@/pages/shell/Search'
import { MyAssignmentPage } from '@/pages/participant/MyAssignmentPage'
import { MyAssignmentsPage } from '@/pages/participant/MyAssignmentsPage'
import type { Area } from '@/lib/roles'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { ParticipantsPage } from '@/pages/admin/people/ParticipantsPage'
import { ImportParticipantsPage } from '@/pages/admin/participants/ImportParticipantsPage'
import { ParticipantDetailPage } from '@/pages/admin/participants/ParticipantDetailPage'
import { CohortCourses, CohortLayout, CohortOverview, CohortParticipants, CohortSessions, CohortTrainers } from '@/pages/admin/programmes/CohortDetailPage'
import { EditCohortPage, NewCohortPage } from '@/pages/admin/programmes/CohortFormPage'
import { CohortsPage } from '@/pages/admin/programmes/CohortsPage'
import { CoursesPage } from '@/pages/admin/programmes/CoursesPage'
import { AttendanceHistoryPage } from '@/pages/admin/sessions/AttendanceHistoryPage'
import { AttendancePage } from '@/pages/admin/sessions/AttendancePage'
import { EditSessionPage } from '@/pages/admin/sessions/EditSessionPage'
import { ScheduleSessionPage } from '@/pages/admin/sessions/ScheduleSessionPage'
import { SessionDetailPage } from '@/pages/admin/sessions/SessionDetailPage'
import { SessionsPage } from '@/pages/admin/sessions/SessionsPage'
import { NewCoursePage } from '@/pages/admin/programmes/NewCoursePage'
import { ProgrammeDetailPage } from '@/pages/admin/programmes/ProgrammeDetailPage'
import { EditProgrammePage, NewProgrammePage } from '@/pages/admin/programmes/ProgrammeFormPage'
import { ProgrammesPage } from '@/pages/admin/programmes/ProgrammesPage'
import { TrainerDetailPage } from '@/pages/admin/people/TrainerDetailPage'
import { TrainersPage } from '@/pages/admin/people/TrainersPage'
import { ForgotPasswordPage } from '@/pages/onboarding/ForgotPasswordPage'
import { InvitationPage } from '@/pages/onboarding/InvitationPage'
import { OrganisationPage } from '@/pages/onboarding/OrganisationPage'
import { ResetPasswordPage } from '@/pages/onboarding/ResetPasswordPage'
import { SignUpPage } from '@/pages/onboarding/SignUpPage'
import { WorkspaceReadyPage } from '@/pages/onboarding/WorkspaceReadyPage'
import { SignInPage } from '@/pages/SignInPage'
import { TwoStepCodePage } from '@/pages/onboarding/TwoStepCodePage'
import { navigation } from './navigation'

/** Screens that are built; everything else in the sidebar shows a placeholder. */

/** F1 Settings pages, by path (the menu is in settingsMenu.ts). */
const settingsPages: Record<string, () => React.JSX.Element> = {
  organisation: OrganisationSettingsPage,
  members: MembersSettingsPage,
  billing: BillingPage,
  privacy: PrivacyPage,
  'programme-setup': ProgrammeSetupPage,
  completion: CompletionSettingsPage,
  'attention-rules': AttentionRulesPage,
  attendance: AttendanceSettingsPage,
  'session-reports': SessionReportSettingsPage,
  profile: ProfileSettingsPage,
  notifications: NotificationSettingsPage,
}

const built: Partial<Record<Area, RouteObject[]>> = {
  admin: [
    { index: true, element: <OverviewPage /> },
    { path: 'reports', element: <ReportsPage /> },
    { path: 'notifications', element: <NotificationsPage area="admin" /> },
    { path: 'search', element: <SearchPage area="admin" /> },
    { path: 'needs-attention', element: <NeedsAttentionPage /> },
    { path: 'needs-attention/interventions', element: <InterventionsPage /> },
    { path: 'trainers', element: <TrainersPage /> },
    { path: 'trainers/:id', element: <TrainerDetailPage /> },
    { path: 'participants', element: <ParticipantsPage /> },
    { path: 'participants/import', element: <ImportParticipantsPage /> },
    { path: 'participants/certificates', element: <CertificatesPage /> },
    { path: 'participants/certificates/:id', element: <AdminCertificatePage /> },
    { path: 'participants/outcomes', element: <OutcomesPage /> },
    { path: 'participants/:id', element: <ParticipantDetailPage /> },
    { path: 'programmes', element: <ProgrammesPage /> },
    { path: 'programmes/new', element: <NewProgrammePage /> },
    { path: 'programmes/:id', element: <ProgrammeDetailPage /> },
    { path: 'programmes/:id/edit', element: <EditProgrammePage /> },
    { path: 'courses', element: <SessionsPage /> },
    { path: 'courses/library', element: <CoursesPage /> },
    { path: 'courses/library/:id', element: <CourseDetailPage /> },
    { path: 'courses/library/:id/edit', element: <EditCoursePage /> },
    { path: 'courses/sessions/new', element: <ScheduleSessionPage /> },
    { path: 'courses/sessions/:id', element: <SessionDetailPage /> },
    { path: 'courses/sessions/:id/edit', element: <EditSessionPage /> },
    { path: 'courses/sessions/:id/attendance', element: <AttendancePage /> },
    { path: 'courses/sessions/:id/attendance/history', element: <AttendanceHistoryPage /> },
    { path: 'courses/sessions/:id/attendance/zoom', element: <ZoomMatchPage /> },
    { path: 'courses/sessions/:id/feedback', element: <SessionFeedbackPage area="admin" /> },
    { path: 'courses/new', element: <NewCoursePage /> },
    { path: 'courses/assignments', element: <AdminAssignmentsPage /> },
    { path: 'courses/reports', element: <SessionReportsPage /> },
    { path: 'courses/reports/:sessionId', element: <SessionReportPage /> },
    { path: 'courses/assignments/grading-scales', element: <GradeScalesPage /> },
    { path: 'courses/assignments/:id', element: <AssignmentPage area="admin" /> },
    { path: 'courses/assignments/:id/submissions/:memberId', element: <SubmissionPage area="admin" /> },
    { path: 'cohorts', element: <CohortsPage /> },
    { path: 'cohorts/new', element: <NewCohortPage /> },
    { path: 'cohorts/:id/edit', element: <EditCohortPage /> },
    {
      path: 'cohorts/:id',
      element: <CohortLayout />,
      children: [
        { index: true, element: <CohortOverview /> },
        { path: 'participants', element: <CohortParticipants /> },
        { path: 'sessions', element: <CohortSessions /> },
        { path: 'courses', element: <CohortCourses /> },
        { path: 'trainers', element: <CohortTrainers /> },
      ],
    },
    {
      path: 'settings',
      element: <SettingsLayout />,
      children: [{ index: true, element: <SettingsIndex /> }, ...Object.entries(settingsPages).map(([path, Page]) => ({ path, element: <Page /> }))],
    },
  ],
  trainer: [
    { index: true, element: <TodayPage /> },
    { path: 'restricted', element: <AdminOnlyPage /> },
    { path: 'settings', element: <AccountSettingsPage area="trainer" /> },
    { path: 'notifications', element: <NotificationsPage area="trainer" /> },
    { path: 'search', element: <SearchPage area="trainer" /> },
    { path: 'reports', element: <SessionReportsPage /> },
    { path: 'reports/:sessionId', element: <SessionReportPage /> },
    { path: 'grading', element: <TrainerAssignmentsPage /> },
    { path: 'grading/new', element: <AssignmentFormPage mode="new" /> },
    { path: 'grading/:id', element: <AssignmentPage area="trainer" /> },
    { path: 'grading/:id/edit', element: <AssignmentFormPage mode="edit" /> },
    { path: 'grading/:id/submissions/:memberId', element: <SubmissionPage area="trainer" /> },
    { path: 'sessions', element: <TrainerSessionsPage /> },
    { path: 'sessions/new', element: <ScheduleSessionPage /> },
    { path: 'sessions/:id', element: <SessionDetailPage /> },
    { path: 'sessions/:id/edit', element: <EditSessionPage /> },
    { path: 'sessions/:id/attendance', element: <AttendancePage /> },
    { path: 'sessions/:id/attendance/history', element: <AttendanceHistoryPage /> },
    { path: 'sessions/:id/attendance/zoom', element: <ZoomMatchPage /> },
    { path: 'sessions/:id/feedback', element: <SessionFeedbackPage area="trainer" /> },
    { path: 'cohorts', element: <MyCohortsPage /> },
    {
      path: 'cohorts/:id',
      element: <MyCohortLayout />,
      children: [
        { index: true, element: <MyCohortOverview /> },
        { path: 'participants', element: <MyCohortParticipants /> },
        { path: 'sessions', element: <MyCohortSessions /> },
        { path: 'courses', element: <MyCohortCourses /> },
      ],
    },
    { path: 'participants', element: <MyParticipantsPage /> },
    { path: 'participants/:id', element: <TrainerParticipantPage /> },
  ],
  participant: [
    { index: true, element: <DashboardPage /> },
    { path: 'courses', element: <MyCoursesPage /> },
    { path: 'courses/:id', element: <CoursePage /> },
    { path: 'sessions', element: <MySessionsPage /> },
    { path: 'sessions/:id', element: <MySessionPage /> },
    { path: 'settings', element: <SettingsPage /> },
    { path: 'notifications', element: <NotificationsPage area="participant" /> },
    { path: 'search', element: <SearchPage area="participant" /> },
    { path: 'assignments', element: <MyAssignmentsPage /> },
    { path: 'assignments/:id', element: <MyAssignmentPage /> },
    { path: 'grades', element: <GradesPage /> },
    { path: 'grades/progress', element: <ProgressPage /> },
    { path: 'grades/certificate', element: <MyCertificatePage /> },
    { path: 'grades/:id', element: <FeedbackPage /> },
    // The link in the certificate email.
    { path: 'certificate', element: <Navigate to="/participant/grades/certificate" replace /> },
  ],
}

function areaRoutes(area: Area): RouteObject {
  const ready = built[area] ?? []
  return {
    path: `/${area}`,
    element: (
      <RequireArea area={area}>
        <AppShell area={area} />
      </RequireArea>
    ),
    children: [
      {
        // X1.02: a page that crashes shows the error inside the shell, so the navigation still works.
        errorElement: <ServerErrorPage area={area} />,
        children: [
          ...ready,
          ...navigation[area]
            .filter((item) => !ready.some((route) => route.path === item.path || (item.path === '' && route.index)))
            .map((item) => ({
              ...(item.path ? { path: item.path } : { index: true }),
              element: <PlaceholderPage title={item.label} screen={item.screen} />,
            })),
          // X1.01
          { path: '*', element: <NotFoundPage area={area} /> },
        ],
      },
    ],
  }
}
export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/sign-in" replace /> },
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/sign-in/code', element: <TwoStepCodePage /> },
  // Admin sign-up (R1)
  { path: '/signup', element: <SignUpPage /> },
  { path: '/signup/organisation', element: <OrganisationPage /> },
  { path: '/signup/ready', element: <WorkspaceReadyPage /> },
  // Account recovery, all roles (S1)
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  // Staff and participant invitations (T1 / P1)
  { path: '/invite/:token', element: <InvitationPage /> },
  { path: '/welcome/profile', element: <WelcomeProfilePage /> },
  { path: '/welcome', element: <WelcomePage /> },
  areaRoutes('admin'),
  areaRoutes('trainer'),
  areaRoutes('participant'),
  // X1.03 Session ended
  { path: '/signed-out', element: <SignedOutPage /> },
  { path: '*', element: <RootNotFound /> },
]

export const router = createBrowserRouter(routes)
