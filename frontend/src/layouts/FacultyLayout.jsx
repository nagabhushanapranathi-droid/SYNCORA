import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'

export default function FacultyLayout() {
  const location = useLocation()

  const getPageInfo = (path) => {
    if (path.includes('/faculty/timetable')) {
      return { title: 'My Teaching Schedule', subtitle: 'Personal weekly timetable and assigned substitutions' }
    }
    if (path.includes('/faculty/substitutions')) {
      return { title: 'My Substitution Duties', subtitle: 'Acknowledge coverage duties and view class details' }
    }
    if (path.includes('/faculty/notifications')) {
      return { title: 'Notifications & Alerts', subtitle: 'Schedule changes, substitution notices, and announcements' }
    }
    return { title: 'Faculty Dashboard', subtitle: 'Welcome to your teaching hub and daily schedule' }
  }

  const { title, subtitle } = getPageInfo(location.pathname)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar role="faculty" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar title={title} subtitle={subtitle} role="faculty" />
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
