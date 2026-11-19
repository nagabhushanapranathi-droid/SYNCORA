import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Sparkles,
  Calendar,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { login, user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    if (user) {
      if ((user.role || '').toLowerCase() === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        navigate('/faculty/dashboard', { replace: true })
      }
    }
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Please provide both email and password.')
      return
    }

    setLoading(true)
    try {
      const loggedInUser = await login(email, password)
      toast.success(`Welcome back, ${loggedInUser.name || 'User'}!`)
      if ((loggedInUser.role || '').toLowerCase() === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        navigate('/faculty/dashboard', { replace: true })
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Authentication failed. Please verify your credentials.'
      setError(errMsg)
      toast.error(errMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickFill = (role) => {
    if (role === 'admin') {
      setEmail('admin@syncora.edu')
      setPassword('Admin@123')
    } else {
      setEmail('priya.sharma@syncora.edu')
      setPassword('Faculty@123')
    }
    setError('')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-card border border-border overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        {/* Left Decorative Brand Panel */}
        <div className="lg:col-span-5 bg-secondary/80 p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-border relative">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent text-white flex items-center justify-center shadow-md">
                <Layers className="w-7 h-7 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="font-heading font-bold text-2xl text-accent tracking-wide">
                  SYNCORA
                </h1>
                <p className="text-[11px] font-semibold text-textSecondary uppercase tracking-widest">
                  Academic Engine
                </p>
              </div>
            </div>

            <div className="mt-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                Intelligent Timetable System
              </span>
              <h2 className="font-heading font-bold text-2xl sm:text-3xl text-textPrimary leading-snug">
                Smarter Scheduling. <br />
                <span className="text-accent">Seamless Substitution.</span>
              </h2>
              <p className="text-sm text-textSecondary mt-3 leading-relaxed">
                Empowering academic institutions with automated timetable management, instant conflict resolution, and equitable substitution workflows.
              </p>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="space-y-3.5 my-8">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4" />
              </div>
              <p className="text-xs text-textPrimary font-medium">
                AI-driven fair candidate ranking & workload balancing
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
                <Calendar className="w-4 h-4" />
              </div>
              <p className="text-xs text-textPrimary font-medium">
                Real-time timetable synchronization across departments
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-xs text-textPrimary font-medium">
                Biometric & system attendance verification
              </p>
            </div>
          </div>

          {/* Quick Demo Access Bar */}
          <div className="p-3.5 rounded-2xl bg-white/80 border border-border/80">
            <p className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider mb-2">
              Quick Fill Demo Credentials
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin')}
                className="py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-primary/30 text-accent border border-border transition-all"
              >
                Admin Demo
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('faculty')}
                className="py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-primary/30 text-accent border border-border transition-all"
              >
                Faculty Demo
              </button>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-center bg-card">
          <div className="max-w-md w-full mx-auto">
            <div className="mb-8">
              <h3 className="font-heading font-bold text-2xl text-textPrimary">
                Sign in to your account
              </h3>
              <p className="text-sm text-textSecondary mt-1">
                Enter your institutional email to access your workspace.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3 animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                <p className="text-sm text-error font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label" htmlFor="email">
                  Institutional Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-textSecondary">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. name@syncora.edu"
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label !mb-0" htmlFor="password">
                    Password
                  </label>
                  <span className="text-xs text-textSecondary">
                    Demo: Admin@123 / Faculty@123
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-textSecondary">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-textSecondary hover:text-textPrimary"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3 text-base font-semibold shadow-card hover:shadow-card-hover mt-2"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Sign in to Portal
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-border/80 text-center">
              <p className="text-xs text-textSecondary">
                SYNCORA Academic Portal &bull; Enterprise Timetable & Substitution Engine
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
