import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AdminLayout from './layouts/AdminLayout'
import FacultyLayout from './layouts/FacultyLayout'

// Pages load on demand (the shell shows a skeleton meanwhile), so sign-in stays light.
// Admin
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const FacultyPage = lazy(() => import('./pages/admin/Faculty'))
const AcademicsPage = lazy(() => import('./pages/admin/Academics'))
const AttendancePage = lazy(() => import('./pages/admin/Attendance'))
const TimetablePage = lazy(() => import('./pages/admin/Timetable'))
const AbsencesPage = lazy(() => import('./pages/admin/Absences'))
const SubstitutionsPage = lazy(() => import('./pages/admin/Substitutions'))
const ReportsPage = lazy(() => import('./pages/admin/Reports'))
const SettingsPage = lazy(() => import('./pages/admin/Settings'))

// Faculty
const FacultyDashboard = lazy(() => import('./pages/faculty/Dashboard'))
const FacultyTimetable = lazy(() => import('./pages/faculty/Timetable'))
const FacultySubstitutions = lazy(() => import('./pages/faculty/Substitutions'))
const FacultyProfile = lazy(() => import('./pages/faculty/Profile'))

// Shared workspaces
const AssistantPage = lazy(() => import('./pages/AssistantPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const LessonPlanPage = lazy(() => import('./pages/LessonPlanPage'))

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="faculty" element={<FacultyPage />} />
        <Route path="academics" element={<AcademicsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="timetable" element={<TimetablePage />} />
        <Route path="absences" element={<AbsencesPage />} />
        <Route path="substitutions" element={<SubstitutionsPage />} />
        <Route path="lesson-plan/:requestId" element={<LessonPlanPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="ai-assistant" element={<Navigate to="/admin/assistant" replace />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route
        path="/faculty"
        element={
          <ProtectedRoute allowedRoles={['faculty', 'admin']}>
            <FacultyLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/faculty/dashboard" replace />} />
        <Route path="dashboard" element={<FacultyDashboard />} />
        <Route path="timetable" element={<FacultyTimetable />} />
        <Route path="substitutions" element={<FacultySubstitutions />} />
        <Route path="lesson-plan/:requestId" element={<LessonPlanPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<FacultyProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
