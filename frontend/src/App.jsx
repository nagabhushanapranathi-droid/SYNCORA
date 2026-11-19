import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'

// Admin Layout & Pages
import AdminLayout from './layouts/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import FacultyPage from './pages/admin/Faculty'
import AttendancePage from './pages/admin/Attendance'
import TimetablePage from './pages/admin/Timetable'
import AbsencesPage from './pages/admin/Absences'
import SubstitutionsPage from './pages/admin/Substitutions'
import AIAssistantPage from './pages/admin/AIAssistant'
import ReportsPage from './pages/admin/Reports'
import SettingsPage from './pages/admin/Settings'

// Faculty Layout & Pages
import FacultyLayout from './layouts/FacultyLayout'
import FacultyDashboard from './pages/faculty/Dashboard'
import FacultyTimetable from './pages/faculty/Timetable'
import FacultySubstitutions from './pages/faculty/Substitutions'
import FacultyNotifications from './pages/faculty/Notifications'

export default function App() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public Login Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Admin Routes */}
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
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="timetable" element={<TimetablePage />} />
        <Route path="absences" element={<AbsencesPage />} />
        <Route path="substitutions" element={<SubstitutionsPage />} />
        <Route path="ai-assistant" element={<AIAssistantPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Protected Faculty Routes */}
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
        <Route path="notifications" element={<FacultyNotifications />} />
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
