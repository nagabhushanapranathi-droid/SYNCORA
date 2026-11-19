import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'

export default function AdminLayout() {
  const location = useLocation()

  const getPageInfo = (path) => {
    if (path.includes('/admin/faculty')) {
      return { title: 'Faculty Management', subtitle: 'Manage academic faculty directory, profiles, and subjects' }
    }
    if (path.includes('/admin/attendance')) {
      return { title: 'Faculty Attendance', subtitle: 'Real-time biometric & system login tracking' }
    }
    if (path.includes('/admin/timetable')) {
      return { title: 'Academic Timetable', subtitle: 'Weekly master schedule, room allocations, and conflict views' }
    }
    if (path.includes('/admin/absences')) {
      return { title: 'Absence Reporting', subtitle: 'Log unplanned absences and auto-generate coverage requirements' }
    }
    if (path.includes('/admin/substitutions')) {
      return { title: 'Substitution Dispatch & Approval', subtitle: 'AI-assisted allocation, candidate rankings, and actions' }
    }
    if (path.includes('/admin/ai-assistant')) {
      return { title: 'SYNCORA AI Assistant', subtitle: 'Natural language queries, schedule explanations, and daily briefings' }
    }
    if (path.includes('/admin/reports')) {
      return { title: 'Analytics & Reports', subtitle: 'Workload distribution, substitution metrics, and AI summary' }
    }
    if (path.includes('/admin/settings')) {
      return { title: 'System Settings', subtitle: 'Platform configurations, model parameters, and credentials' }
    }
    return { title: 'Executive Overview', subtitle: 'Live institutional schedule metrics and pending workflows' }
  }

  const { title, subtitle } = getPageInfo(location.pathname)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar role="admin" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar title={title} subtitle={subtitle} role="admin" />
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
