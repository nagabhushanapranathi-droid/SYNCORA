import { Mail, History, Palette, BookOpen } from 'lucide-react'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import { Skeleton } from '../../components/LoadingSpinner'
import { ThemePreference } from '../../components/ThemeToggle'
import { PageHeader, SheetHeader, ErrorState, Avatar, Meta } from '../../components/ui'
import { facultyService } from '../../services/facultyService'
import { attendanceService } from '../../services/attendanceService'
import { useAuth } from '../../context/AuthContext'
import useLoad from '../../lib/useLoad'
import { asList, isoDate, hhmm } from '../../lib/format'

export default function FacultyProfile() {
  const { user } = useAuth()
  const fid = user?.faculty_id
  const profile = useLoad(() => (fid ? facultyService.getById(fid) : Promise.resolve(null)), [fid])
  const history = useLoad(() => (fid ? facultyService.getHistory(fid) : Promise.resolve(null)), [fid])
  const att = useLoad(() => (fid ? attendanceService.getAll({ faculty_id: fid, date: isoDate() }).then((d) => asList(d)[0] || null) : Promise.resolve(null)), [fid])

  const p = profile.data
  const items = history.data?.history || []

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader title="Profile" description="Your faculty record as SYNCORA uses it for timetabling and cover. Ask an administrator to change these details." />

      <section className="sheet-feature p-5 sm:p-6 pt-7">
        {profile.loading ? (
          <Skeleton className="h-24" />
        ) : profile.error ? (
          <ErrorState compact message={profile.error} onRetry={profile.reload} />
        ) : !p ? (
          <EmptyState compact title="No faculty record linked" description="This account is not connected to a faculty profile." />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <Avatar name={p.name} size="xl" />
            <div className="min-w-0 flex-1">
              <h2 className="font-heading font-black text-2xl text-ink">{p.name}</h2>
              <p className="text-base text-ink-2">
                {p.designation}, {p.department_name}
              </p>
              <p className="text-sm text-ink-2 mt-1 inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {p.email}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-ink-2">Today</p>
              {att.loading ? (
                <Skeleton className="h-6 w-24 mt-1" />
              ) : (
                <div className="mt-1 flex sm:justify-end">
                  <Badge status={att.data?.status || 'NOT_MARKED'} />
                </div>
              )}
              {att.data?.login_time && <p className="text-xs text-ink-2 mt-1">Checked in at {hhmm(att.data.login_time)}</p>}
            </div>
          </div>
        )}
        {p && (
          <dl className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <Meta label="Specialization">{p.specialization || 'Not set'}</Meta>
            <Meta label="Status">{p.is_active ? 'Active' : 'Inactive'}</Meta>
            <Meta label="Cover duties on record">{history.data?.total_substitutions ?? '—'}</Meta>
          </dl>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="sheet" aria-labelledby="subj-h">
          <SheetHeader title={<span id="subj-h">Qualified subjects</span>} description="You are ranked as an expert substitute for these." icon={BookOpen} />
          <div className="px-5 pb-5">
            {!p ? (
              <Skeleton className="h-12" />
            ) : (p.subjects || []).length === 0 ? (
              <p className="text-sm text-ink-2">No subjects assigned yet.</p>
            ) : (
              <ul className="space-y-2">
                {p.subjects.map((s) => (
                  <li key={s.id} className="panel px-3.5 py-2.5 flex items-center justify-between gap-3">
                    <span className="font-semibold text-ink">{s.name}</span>
                    <span className="text-xs text-ink-2">{s.code}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="sheet" aria-labelledby="hist-h">
          <SheetHeader title={<span id="hist-h">Cover history</span>} icon={History} />
          <div className="px-5 pb-5">
            {history.loading ? (
              <Skeleton className="h-24" />
            ) : history.error ? (
              <ErrorState compact message={history.error} onRetry={history.reload} />
            ) : items.length === 0 ? (
              <p className="text-sm text-ink-2">You have not been assigned cover yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink truncate">{h.subject}</p>
                      <p className="text-xs text-ink-2">
                        {h.class_name}, {h.date}
                      </p>
                    </div>
                    <Badge status={h.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="sheet" aria-labelledby="ap-h">
        <SheetHeader title={<span id="ap-h">Appearance</span>} description="Saved in this browser only." icon={Palette} />
        <div className="px-5 pb-5">
          <ThemePreference />
        </div>
      </section>
    </div>
  )
}
