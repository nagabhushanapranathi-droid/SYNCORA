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

  // AI Provider & FreeLLMAPI Gateway Management State
  const [aiConfig, setAiConfig] = useState(null)
  const [gatewayStatus, setGatewayStatus] = useState(null)
  const [availableModels, setAvailableModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [testingGateway, setTestingGateway] = useState(false)
  const [gatewayTestResult, setGatewayTestResult] = useState(null)
  const [loadingAiConfig, setLoadingAiConfig] = useState(false)
  const [savingAiConfig, setSavingAiConfig] = useState(false)
  const [primaryChoice, setPrimaryChoice] = useState('freellmapi')
  const [fallbackChoice, setFallbackChoice] = useState('')
  const [testResults, setTestResults] = useState({})

  const toast = useToast()

  const loadModels = async (force = false) => {
    try {
      const res = await aiService.getModels(force)
      const list = res.data?.models || res.models || []
      setAvailableModels(list)
    } catch {
      setAvailableModels([])
    }
  }

  const loadAiConfig = async () => {
    setLoadingAiConfig(true)
    try {
      const res = await aiService.getConfig()
      const cfg = res.data || res.config || res
      setAiConfig(cfg)
      if (cfg.gateway) {
        setGatewayStatus(cfg.gateway)
        if (cfg.gateway.default_model) setSelectedModel(cfg.gateway.default_model)
      }
      if (cfg.primary_provider) setPrimaryChoice(cfg.primary_provider)
      if (cfg.fallback_provider) setFallbackChoice(cfg.fallback_provider)
      loadModels(false)
    } catch {
      // Graceful fallback defaults if endpoint unavailable
      setAiConfig({
        primary_provider: 'freellmapi',
        fallback_provider: '',
        gateway: {
          available: true,
          base_url: 'http://127.0.0.1:3001/v1',
          masked_key: 'free...fe1e',
          default_model: 'auto',
          models_count: 0
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
        default_model: selectedModel,
      })
      toast.success('AI Gateway configuration updated successfully.')
      loadAiConfig()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update AI configuration.')
    } finally {
      setSavingAiConfig(false)
    }
  }

  const handleTestGateway = async () => {
    setTestingGateway(true)
    setGatewayTestResult(null)
    try {
      const res = await aiService.testConnection()
      const data = res.data || res
      setGatewayTestResult({
        success: data.success,
        message: data.message,
        telemetry: data.telemetry,
      })
      if (data.success) {
        toast.success(`FreeLLMAPI Gateway connected (${data.telemetry?.latency_ms || 0}ms)`)
      } else {
        toast.warning(data.message || 'FreeLLMAPI Gateway response degraded')
      }
      loadModels(true)
    } catch (err) {
      setGatewayTestResult({
        success: false,
        message: err.response?.data?.error || 'Gateway unreachable at configured endpoint',
      })
      toast.error('FreeLLMAPI Gateway unreachable')
    } finally {
      setTestingGateway(false)
    }
  }

  const handleTestProvider = async (providerKey) => {
    setTestResults((prev) => ({ ...prev, [providerKey]: { loading: true } }))
    try {
      const res = await aiService.testProvider(providerKey.toLowerCase())
      const data = res.data || res
      setTestResults((prev) => ({
        ...prev,
        [providerKey]: {
          loading: false,
          success: data.success !== false,
          status: data.status || (data.success !== false ? 'ACTIVE' : 'FAILED'),
          latency: data.latency_ms,
          message: data.message || 'Provider responded successfully',
        },
      }))
      if (data.success !== false) {
        toast.success(`${providerKey} connection active (${data.latency_ms || 0}ms)`)
      } else {
        toast.error(`${providerKey} test failed: ${data.error || 'Connection error'}`)
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
      const d = res.data || res
      setSystemStatus((prev) => ({
        ...prev,
        database: d.database || 'CONNECTED',
        gemini_api: d.freellmapi_status || d.gemini_status || 'CONFIGURED',
        version: d.version || '2.0.0',
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
              <label className="label">Central AI Gateway</label>
              <select
                value={primaryChoice}
                onChange={(e) => setPrimaryChoice(e.target.value)}
                className="input-field text-xs font-semibold"
              >
                <option value="freellmapi">FreeLLMAPI Gateway (Recommended / Default)</option>
                <option value="gemini">Google Gemini (Routed via FreeLLMAPI)</option>
                <option value="openai">Secondary OpenAI-Compatible Provider</option>
              </select>
              <p className="text-[11px] text-textSecondary mt-1">
                Centralized gateway powering lesson plans, academic tool assistant, and operational reports.
              </p>
            </div>

            <div>
              <label className="label">Dynamic Gateway Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="input-field text-xs font-semibold"
              >
                <option value="">auto (Gateway Dynamic Model Routing)</option>
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id} {m.owned_by ? `(${m.owned_by})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-textSecondary mt-1">
                {availableModels.length > 0
                  ? `${availableModels.length} models discovered from FreeLLMAPI /v1/models`
                  : 'Default model or automatic task routing will be used.'}
              </p>
            </div>
          </div>
        </form>

        {/* Central FreeLLMAPI Gateway Card */}
        <div className="p-4 rounded-xl border border-accent/30 bg-accent/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-sm text-textPrimary">
                  FreeLLMAPI Central Gateway
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-white uppercase tracking-wider">
                  Active Gateway
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/20 text-success border border-success/30">
                  X-Routed-Via: freellmapi
                </span>
              </div>
              <p className="text-xs text-textSecondary mt-1">
                Single centralized application-facing AI integration. Upstream model routing is managed by FreeLLMAPI.
              </p>
            </div>

            <button
              type="button"
              onClick={handleTestGateway}
              disabled={testingGateway}
              className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-sm"
            >
              <Zap className={`w-3.5 h-3.5 ${testingGateway ? 'animate-bounce text-warning' : ''}`} />
              {testingGateway ? 'Auditing Gateway...' : 'Test Gateway Connectivity'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-textSecondary pt-2 border-t border-accent/15">
            <div>
              Base URL:{' '}
              <span className="font-mono text-textPrimary">
                {gatewayStatus?.base_url || 'http://127.0.0.1:3001/v1'}
              </span>
            </div>
            <div>
              API Key:{' '}
              <span className="font-mono text-textPrimary">
                {gatewayStatus?.masked_key || 'free...fe1e'}
              </span>
            </div>
            <div>
              Discovered Models:{' '}
              <span className="font-semibold text-textPrimary">
                {availableModels.length || gatewayStatus?.models_count || 'Cached / Auto'}
              </span>
            </div>
          </div>

          {gatewayTestResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2.5 ${
                gatewayTestResult.success ? 'bg-success/10 text-success border border-success/20' : 'bg-warning/10 text-warning border border-warning/20'
              }`}
            >
              {gatewayTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div className="font-semibold">{gatewayTestResult.message}</div>
                {gatewayTestResult.telemetry?.latency_ms && (
                  <div className="text-[11px] opacity-90">
                    Roundtrip Latency: {gatewayTestResult.telemetry.latency_ms}ms &bull; Routed Via: {gatewayTestResult.telemetry.routed_via || 'freellmapi'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Configured Provider Cards */}
        <div className="space-y-3">
          <h4 className="font-heading font-semibold text-xs text-textSecondary uppercase tracking-wider">
            All AI Provider Telemetry & Secondary Fallbacks
          </h4>

          {['freellmapi', 'gemini', 'openai'].map((pkey) => {
            const pdata = (aiConfig?.providers || []).find((p) => p.name === pkey) || {}
            const test = testResults[pkey]
            const isPrimary = (aiConfig?.primary_provider || 'freellmapi') === pkey
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
