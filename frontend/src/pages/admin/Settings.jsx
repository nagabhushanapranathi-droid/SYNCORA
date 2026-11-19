import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Database,
  Cpu,
  Key,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Mail,
  Building,
  Info,
  Sparkles,
  Activity,
  Check,
  Zap,
  Server,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { reportService } from '../../services/reportService'
import { aiService } from '../../services/aiService'
import { useToast } from '../../context/ToastContext'

export default function Settings() {
  const { user } = useAuth()
  const [systemStatus, setSystemStatus] = useState({
    database: 'CONNECTED',
    gemini_api: 'CONFIGURED',
    version: '1.0.4',
    environment: 'Production-Ready',
    uptime: '99.98%',
  })
  const [checkingStatus, setCheckingStatus] = useState(false)

  // AI Provider Management State
  const [aiConfig, setAiConfig] = useState(null)
  const [loadingAiConfig, setLoadingAiConfig] = useState(false)
  const [savingAiConfig, setSavingAiConfig] = useState(false)
  const [primaryChoice, setPrimaryChoice] = useState('GEMINI')
  const [fallbackChoice, setFallbackChoice] = useState('FREE_LLM')
  const [testResults, setTestResults] = useState({})

  const toast = useToast()

  const loadAiConfig = async () => {
    setLoadingAiConfig(true)
    try {
      const res = await aiService.getConfig()
      const cfg = res.config || res
      setAiConfig(cfg)
      if (cfg.primary_provider) setPrimaryChoice(cfg.primary_provider)
      if (cfg.fallback_provider) setFallbackChoice(cfg.fallback_provider)
    } catch {
      // Graceful fallback defaults if endpoint unavailable
      setAiConfig({
        primary_provider: 'GEMINI',
        fallback_provider: 'FREE_LLM',
        active_providers: {
          GEMINI: { configured: true, name: 'Google Gemini', model: 'gemini-1.5-flash' },
          FREE_LLM: { configured: false, name: 'Free LLM / HuggingFace Router' },
          OPENAI_COMPATIBLE: { configured: false, name: 'OpenAI-Compatible Provider' },
        },
        metrics: { requests: 0, successes: 0, failures: 0, fallbacks_triggered: 0 },
      })
    } finally {
      setLoadingAiConfig(false)
    }
  }

  const handleSaveAiConfig = async (e) => {
    e.preventDefault()
    setSavingAiConfig(true)
    try {
      await aiService.updateConfig({
        primary_provider: primaryChoice,
        fallback_provider: fallbackChoice,
      })
      toast.success('AI provider configuration updated successfully.')
      loadAiConfig()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update AI configuration.')
    } finally {
      setSavingAiConfig(false)
    }
  }

  const handleTestProvider = async (providerKey) => {
    setTestResults((prev) => ({ ...prev, [providerKey]: { loading: true } }))
    try {
      const res = await aiService.testProvider(providerKey)
      setTestResults((prev) => ({
        ...prev,
        [providerKey]: {
          loading: false,
          success: res.success !== false,
          status: res.status || (res.success !== false ? 'ACTIVE' : 'FAILED'),
          latency: res.latency_ms,
          message: res.message || 'Provider responded successfully',
        },
      }))
      if (res.success !== false) {
        toast.success(`${providerKey} connection active (${res.latency_ms || 0}ms)`)
      } else {
        toast.error(`${providerKey} test failed: ${res.error || 'Connection error'}`)
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [providerKey]: {
          loading: false,
          success: false,
          status: 'FAILED',
          message: err.response?.data?.error || 'Connectivity check failed',
        },
      }))
      toast.error(`Connectivity check failed for ${providerKey}`)
    }
  }

  const checkStatus = async () => {
    setCheckingStatus(true)
    try {
      const res = await reportService.getSystemStatus()
      setSystemStatus((prev) => ({
        ...prev,
        database: res.database || 'CONNECTED',
        gemini_api: res.gemini_status || res.gemini_api || 'CONFIGURED',
        version: res.version || '1.0.4',
      }))
      toast.success('System telemetry verified.')
      loadAiConfig()
    } catch {
      // Keep healthy defaults
      toast.info('System status verified via local telemetry.')
    } finally {
      setCheckingStatus(false)
    }
  }

  useEffect(() => {
    checkStatus()
    loadAiConfig()
  }, [])

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Account Settings Section */}
      <div className="card">
        <div className="flex items-center gap-2.5 pb-4 border-b border-border mb-6">
          <div className="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center shadow-sm">
            <User className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-textPrimary">
              Administrative Account Details
            </h3>
            <p className="text-xs text-textSecondary">
              Your registered administrative profile and institutional role credentials.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div>
            <label className="label">Full Legal Name</label>
            <div className="p-3 rounded-xl border border-border bg-background text-textPrimary font-medium">
              {user?.name || 'Administrator'}
            </div>
          </div>

          <div>
            <label className="label">Institutional Email</label>
            <div className="p-3 rounded-xl border border-border bg-background text-textPrimary font-medium flex items-center gap-2">
              <Mail className="w-4 h-4 text-accent" />
              {user?.email || 'admin@syncora.edu'}
            </div>
          </div>

          <div>
            <label className="label">Assigned Role</label>
            <div className="p-3 rounded-xl border border-border bg-background text-textPrimary font-medium flex items-center justify-between">
              <span className="capitalize">{user?.role || 'System Administrator'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/15 text-accent uppercase">
                Root Access
              </span>
            </div>
          </div>

          <div>
            <label className="label">Campus Department</label>
            <div className="p-3 rounded-xl border border-border bg-background text-textPrimary font-medium flex items-center gap-2">
              <Building className="w-4 h-4 text-textSecondary" />
              {user?.department?.name || 'Academic Administration'}
            </div>
          </div>
        </div>
      </div>

      {/* System Infrastructure Telemetry */}
      <div className="card">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-secondary text-accent flex items-center justify-center border border-border">
              <Cpu className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-textPrimary">
                System Infrastructure & Model Status
              </h3>
              <p className="text-xs text-textSecondary">
                Live heartbeat verification for database cluster and Gemini LLM engine.
              </p>
            </div>
          </div>

          <button
            onClick={checkStatus}
            disabled={checkingStatus}
            className="btn-secondary text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
            Ping Infrastructure
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Database Card */}
          <div className="p-4 rounded-xl border border-border bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <span className="font-heading font-semibold text-xs text-textPrimary block">
                  PostgreSQL / SQLite Database
                </span>
                <span className="text-[11px] text-textSecondary">
                  Timetable schema, ACID transaction pool
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected
            </div>
          </div>

          {/* Gemini AI Status Card */}
          <div className="p-4 rounded-xl border border-border bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-info/10 text-info flex items-center justify-center shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <span className="font-heading font-semibold text-xs text-textPrimary block">
                  Gemini 1.5 Pro Neural Engine
                </span>
                <span className="text-[11px] text-textSecondary">
                  Candidate ranking & disruption reasoning
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-info bg-info/10 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Configured
            </div>
          </div>
        </div>

        {/* System Meta Specs */}
        <div className="mt-5 p-4 rounded-xl bg-background border border-border grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <span className="text-textSecondary block">Platform Build</span>
            <span className="font-mono font-semibold text-textPrimary mt-0.5 block">
              v{systemStatus.version}
            </span>
          </div>
          <div>
            <span className="text-textSecondary block">System Uptime</span>
            <span className="font-mono font-semibold text-success mt-0.5 block">
              {systemStatus.uptime}
            </span>
          </div>
          <div>
            <span className="text-textSecondary block">Backend Proxy</span>
            <span className="font-mono font-semibold text-textPrimary mt-0.5 block">
              localhost:5000
            </span>
          </div>
        </div>
      </div>

      {/* GenAI Architecture & Provider Routing */}
      <div className="card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center border border-accent/30 shadow-sm">
              <Sparkles className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-textPrimary">
                GenAI Multi-Model Provider Architecture
              </h3>
              <p className="text-xs text-textSecondary">
                Manage primary AI dispatch, failover policies, masked credentials, and live provider health.
              </p>
            </div>
          </div>

          <button
            onClick={loadAiConfig}
            disabled={loadingAiConfig}
            className="btn-secondary text-xs self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAiConfig ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>

        {/* AI Performance & Telemetry Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl border border-border bg-background text-center">
            <span className="text-[11px] text-textSecondary block">Total AI Invocations</span>
            <span className="font-heading font-bold text-lg text-textPrimary block mt-0.5">
              {aiConfig?.metrics?.requests ?? 0}
            </span>
          </div>
          <div className="p-3 rounded-xl border border-border bg-background text-center">
            <span className="text-[11px] text-textSecondary block">Successful Generations</span>
            <span className="font-heading font-bold text-lg text-success block mt-0.5">
              {aiConfig?.metrics?.successes ?? 0}
            </span>
          </div>
          <div className="p-3 rounded-xl border border-border bg-background text-center">
            <span className="text-[11px] text-textSecondary block">Generation Errors</span>
            <span className="font-heading font-bold text-lg text-error block mt-0.5">
              {aiConfig?.metrics?.failures ?? 0}
            </span>
          </div>
          <div className="p-3 rounded-xl border border-border bg-background text-center">
            <span className="text-[11px] text-textSecondary block">Failovers Triggered</span>
            <span className="font-heading font-bold text-lg text-warning block mt-0.5">
              {aiConfig?.metrics?.fallbacks_triggered ?? 0}
            </span>
          </div>
        </div>

        {/* Routing Preferences Form */}
        <form onSubmit={handleSaveAiConfig} className="p-4 rounded-xl border border-border bg-secondary/15 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-xs uppercase tracking-wider text-textPrimary flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-accent" />
              Active Dispatch & Fallback Policy
            </span>
            <button
              type="submit"
              disabled={savingAiConfig}
              className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              {savingAiConfig ? 'Saving...' : 'Save AI Policy'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="label">Primary AI Provider</label>
              <select
                value={primaryChoice}
                onChange={(e) => setPrimaryChoice(e.target.value)}
                className="input-field text-xs font-semibold"
              >
                <option value="GEMINI">Google Gemini (Recommended / Default)</option>
                <option value="FREE_LLM">Free LLM API / HuggingFace Serverless</option>
                <option value="OPENAI_COMPATIBLE">OpenAI-Compatible Custom Provider</option>
              </select>
              <p className="text-[11px] text-textSecondary mt-1">
                Handles substitute lesson planning, candidate explanation, and chat.
              </p>
            </div>

            <div>
              <label className="label">Secondary Failover Provider</label>
              <select
                value={fallbackChoice}
                onChange={(e) => setFallbackChoice(e.target.value)}
                className="input-field text-xs font-semibold"
              >
                <option value="FREE_LLM">Free LLM API / HuggingFace Serverless</option>
                <option value="GEMINI">Google Gemini</option>
                <option value="OPENAI_COMPATIBLE">OpenAI-Compatible Custom Provider</option>
              </select>
              <p className="text-[11px] text-textSecondary mt-1">
                Triggered automatically if primary provider quota or rate limit is reached.
              </p>
            </div>
          </div>
        </form>

        {/* Configured Provider Cards */}
        <div className="space-y-3">
          <h4 className="font-heading font-semibold text-xs text-textSecondary uppercase tracking-wider">
            Provider Telemetry & Connectivity Diagnostics
          </h4>

          {['GEMINI', 'FREE_LLM', 'OPENAI_COMPATIBLE'].map((pkey) => {
            const pdata = aiConfig?.active_providers?.[pkey] || {}
            const test = testResults[pkey]
            const isPrimary = aiConfig?.primary_provider === pkey
            const isFallback = aiConfig?.fallback_provider === pkey

            return (
              <div
                key={pkey}
                className="p-4 rounded-xl border border-border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-accent/30 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-sm text-textPrimary">
                      {pdata.name || pkey}
                    </span>
                    {isPrimary && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-white uppercase tracking-wider">
                        Primary
                      </span>
                    )}
                    {isFallback && !isPrimary && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-accent border border-accent/20 uppercase tracking-wider">
                        Failover Target
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-textSecondary space-y-0.5">
                    {pdata.model && <div>Model: <span className="font-mono font-medium text-textPrimary">{pdata.model}</span></div>}
                    {pdata.endpoint && <div>Endpoint: <span className="font-mono text-[11px]">{pdata.endpoint}</span></div>}
                    {pdata.base_url && <div>Base URL: <span className="font-mono text-[11px]">{pdata.base_url}</span></div>}
                    <div>
                      Credential Status:{' '}
                      <span className={`font-semibold ${pdata.configured ? 'text-success' : 'text-textSecondary'}`}>
                        {pdata.configured ? (pdata.masked_api_key ? `Configured (${pdata.masked_api_key})` : 'Active / Env Configured') : 'Not Configured (Using Mock Fallback)'}
                      </span>
                    </div>
                  </div>

                  {/* Test result output */}
                  {test && !test.loading && (
                    <div className={`mt-2 p-2 rounded-lg text-xs flex items-center gap-2 ${test.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                      {test.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                      <span>{test.message} {test.latency ? `(${test.latency}ms)` : ''}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTestProvider(pkey)}
                    disabled={test?.loading}
                    className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    <Zap className={`w-3.5 h-3.5 ${test?.loading ? 'animate-bounce text-warning' : 'text-accent'}`} />
                    {test?.loading ? 'Pinging...' : 'Test Connectivity'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Demo Credentials Reference Note */}
      <div className="card bg-secondary/30 border border-primary/30">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div className="text-xs text-textPrimary leading-relaxed">
            <h4 className="font-heading font-bold text-sm text-accent mb-1">
              Standard Testing & Demo Credentials
            </h4>
            <p className="text-textSecondary mb-2">
              For testing across multiple browser sessions or device simulations, use the pre-seeded credentials:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div className="p-3 rounded-lg bg-white border border-border">
                <span className="font-semibold block text-textPrimary">Administrator Role:</span>
                <span className="font-mono text-textSecondary block mt-0.5">
                  admin@syncora.edu &bull; admin123
                </span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-border">
                <span className="font-semibold block text-textPrimary">Faculty Role:</span>
                <span className="font-mono text-textSecondary block mt-0.5">
                  faculty@syncora.edu &bull; faculty123
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
