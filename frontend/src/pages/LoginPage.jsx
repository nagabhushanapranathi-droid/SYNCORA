import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, Eye, EyeOff, AlertCircle, ArrowLeftRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../services/api'
import Mascot from '../components/Mascot'
import ThemeToggle from '../components/ThemeToggle'
import { SignatureMotif, Sparkle, Flower, Moon } from '../components/motifs'
import { useTheme } from '../context/ThemeContext'

// Seeded demo accounts (backend/seed.py).
const DEMO = {
  admin: { email: 'admin@syncora.edu', password: 'Admin@123', label: 'Admin office' },
  faculty: { email: 'priya.sharma@syncora.edu', password: 'Faculty@123', label: 'Faculty desk' },
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const { login, user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    if (user) navigate((user.role || '').toLowerCase() === 'admin' ? '/admin/dashboard' : '/faculty/dashboard', { replace: true })
  }, [user, navigate])

  const validate = () => {
    const fe = {}
    if (!email.trim()) fe.email = 'Enter your institutional email.'
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) fe.email = 'That email address looks incomplete.'
    if (!password) fe.password = 'Enter your password.'
    setFieldErrors(fe)
    return Object.keys(fe).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setLoading(true)
    try {
      const u = await login(email.trim(), password)
      if (!u) throw new Error('No user returned')
      toast.success(`Welcome back, ${u.name || 'there'}.`)
      navigate((u.role || '').toLowerCase() === 'admin' ? '/admin/dashboard' : '/faculty/dashboard', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Sign-in failed. Check your email and password, then try again.'))
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (role) => {
    setEmail(DEMO[role].email)
    setPassword(DEMO[role].password)
    setError('')
    setFieldErrors({})
  }

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand side */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-line bg-chrome px-12 py-10">
        <div className="flex items-center gap-2.5 text-brand">
          <SignatureMotif className="w-9 h-7" />
          <span className="font-heading font-black text-2xl tracking-[0.05em] text-ink">SYNCORA</span>
        </div>

        <div className="max-w-[520px]">
          <h1 className="font-heading font-black text-[3.1rem] leading-[1.02] tracking-[-0.02em] text-ink">
            Every class,
            <br />
            covered.
          </h1>
          <p className="mt-4 text-md text-ink-2 max-w-md">
            The timetable, faculty attendance and substitute cover live in one calm place — for the admin office and the faculty desk.
          </p>
          <PlannerIllustration />
        </div>

        <p className="text-sm text-ink-3">Faculty scheduling and academic continuity</p>
      </section>

      {/* Form side */}
      <section className="relative flex flex-col px-5 sm:px-10 py-6 sm:py-10">
        <div className="flex items-center justify-between">
          <span className="lg:hidden flex items-center gap-2 text-brand">
            <SignatureMotif className="w-7 h-6" />
            <span className="font-heading font-black text-xl tracking-[0.05em] text-ink">SYNCORA</span>
          </span>
          <span className="hidden lg:block" />
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-[400px]">
            <div className="lg:hidden mb-8">
              <h1 className="font-heading font-black text-[2.2rem] leading-[1.05] text-ink">Every class, covered.</h1>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <Mascot size={52} mood={error ? 'worried' : loading ? 'thinking' : 'idle'} />
              <div>
                <h2 className="font-heading font-extrabold text-xl text-ink">Sign in</h2>
                <p className="text-sm text-ink-2">Use your institutional email.</p>
              </div>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-3 p-3.5 rounded-panel bg-danger-soft border border-danger/30" role="alert">
                <AlertCircle className="w-5 h-5 text-danger-ink shrink-0" />
                <p className="text-base font-medium text-ink">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label className="field-label" htmlFor="email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@syncora.edu"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'email-err' : undefined}
                    className="input h-11 pl-10"
                  />
                </div>
                {fieldErrors.email && (
                  <p id="email-err" className="field-error">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="field-label" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'password-err' : undefined}
                    className="input h-11 pl-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="btn-icon absolute right-1 top-1/2 -translate-y-1/2"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="password-err" className="field-error">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <button type="submit" disabled={loading} className="btn-primary btn-lg w-full mt-2">
                {loading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="mt-8 panel p-4">
              <p className="text-sm font-semibold text-ink">Demo accounts</p>
              <p className="text-xs text-ink-2 mt-0.5">Seeded for local testing. Choosing one fills the form.</p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {Object.entries(DEMO).map(([role, d]) => (
                  <button key={role} type="button" onClick={() => fillDemo(role)} className="btn-secondary btn-sm">
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/** Decorative planner page — illustration only, carries no data. */
function PlannerIllustration() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const cols = [
    ['bg-ok', 'bg-info', null, 'bg-warn'],
    ['bg-info', null, 'bg-brand-2', 'bg-ok'],
    ['bg-warn', 'bg-ok', 'cover', null],
    [null, 'bg-brand-2', 'bg-info', 'bg-warn'],
    ['bg-ok', 'bg-warn', null, 'bg-info'],
  ]
  return (
    <div className="relative mt-10 w-full max-w-[460px]" aria-hidden="true">
      <div className="sheet-feature p-5 pt-7 rotate-[-1.5deg]">
        <div className="grid grid-cols-5 gap-2.5">
          {['M', 'T', 'W', 'T', 'F'].map((d, i) => (
            <span key={i} className="text-center text-xs font-semibold text-ink-3">
              {d}
            </span>
          ))}
          {cols[0].map((_, row) =>
            cols.map((col, ci) => {
              const cell = col[row]
              if (cell === 'cover') {
                return (
                  <div key={`${ci}-${row}`} className="h-9 rounded-md border-2 border-dashed border-accent bg-accent-soft flex items-center justify-center">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-accent-ink" />
                  </div>
                )
              }
              return <div key={`${ci}-${row}`} className={`h-9 rounded-md ${cell ? `${cell} opacity-80` : 'border border-dashed border-line'}`} />
            })
          )}
        </div>
      </div>
      <div className="absolute -top-11 right-8 rotate-[6deg]">
        <Mascot size={78} mood="happy" />
      </div>
      {dark ? (
        <>
          <Moon className="absolute -left-6 top-6 w-6 h-6 text-info" />
          <Sparkle className="absolute -right-4 bottom-8 w-4 h-4 text-brand" />
        </>
      ) : (
        <>
          <Flower className="absolute -left-5 top-8 w-6 h-6 text-brand-2" />
          <Sparkle className="absolute -right-3 bottom-10 w-4 h-4 text-warn" />
        </>
      )}
    </div>
  )
}
