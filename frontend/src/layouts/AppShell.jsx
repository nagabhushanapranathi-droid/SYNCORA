import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { Skeleton } from '../components/LoadingSpinner'

/**
 * Shared application frame for both portals: persistent sidebar on large screens,
 * slide-over drawer below lg, top bar, and the routed page.
 */
export default function AppShell({ role }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setDrawerOpen(false), [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] btn-primary btn-sm"
      >
        Skip to content
      </a>

      <div className="hidden lg:block shrink-0 no-print">
        <Sidebar role={role} />
      </div>

      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 no-print" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-[rgb(40_28_30/0.4)] dark:bg-[rgb(6_4_10/0.7)] animate-fade" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 animate-slide-in-left">
            <Sidebar role={role} mobile onClose={() => setDrawerOpen(false)} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar role={role} onMenu={() => setDrawerOpen(true)} />
        <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
          <div key={location.pathname} className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-fade-up">
            <Suspense
              fallback={
                <div className="space-y-4" role="status" aria-label="Loading page">
                  <Skeleton className="h-10 w-1/3" />
                  <Skeleton className="h-40" />
                  <Skeleton className="h-64" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
