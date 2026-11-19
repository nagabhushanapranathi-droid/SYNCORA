import { useEffect, useState } from 'react'
import { RefreshCw, Zap, Database, Server, KeyRound, AlertTriangle, CheckCircle2, Palette, UserRound, Cpu, Save, Info } from 'lucide-react'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import { Skeleton } from '../../components/LoadingSpinner'
import { ThemePreference } from '../../components/ThemeToggle'
import { PageHeader, SheetHeader, ErrorState, Field, Meta } from '../../components/ui'
import { reportService } from '../../services/reportService'
import { aiService } from '../../services/aiService'
import { errorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import useLoad from '../../lib/useLoad'
import { relativeTime, formatClock, parseTimestamp } from '../../lib/format'

export default function Settings() {
  const { user } = useAuth()
  const toast = useToast()
  const status = useLoad(() => reportService.getSystemStatus(), [])
  const config = useLoad(() => aiService.getConfig(), [])
  const models = useLoad(() => aiService.getModels(false), [])

  const [form, setForm] = useState({ primary_provider: 'freellmapi', fallback_provider: '', default_model: '', timeout: '', max_retries: '' })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [providerTests, setProviderTests] = useState({})

  const cfg = config.data
  const gw = cfg?.gateway

  useEffect(() => {
    if (!cfg) return
    setForm((f) => ({
      ...f,
      primary_provider: cfg.primary_provider || 'freellmapi',
      fallback_provider: cfg.fallback_provider || '',
      default_model: gw?.default_model || '',
    }))
  }, [cfg, gw?.default_model])

  const modelList = models.data?.models || gw?.available_models || []

  const save = async (e) => {
    e.preventDefault()
    const t = form.timeout === '' ? null : Number(form.timeout)
    const r = form.max_retries === '' ? null : Number(form.max_retries)
    if (t !== null && (Number.isNaN(t) || t < 5 || t > 300)) return toast.error('Timeout must be between 5 and 300 seconds.')
    if (r !== null && (Number.isNaN(r) || r < 0 || r > 5)) return toast.error('Retries must be between 0 and 5.')
    setSaving(true)
    try {
      const payload = { primary_provider: form.primary_provider, fallback_provider: form.fallback_provider }
      if (form.default_model) payload.default_model = form.default_model
      if (t !== null) payload.timeout = t
      if (r !== null) payload.max_retries = r
      await aiService.updateConfig(payload)
      toast.success('AI settings saved for the running server.')
      config.reload()
    } catch (err) {
      toast.error(errorMessage(err, 'AI settings could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  const testGateway = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await aiService.testConnection()
      setTestResult(res)
      models.reload()
    } catch (err) {
      setTestResult({ success: false, message: errorMessage(err, 'The connectivity test could not run.') })
    } finally {
      setTesting(false)
    }
  }

  const testProvider = async (name) => {
    setProviderTests((p) => ({ ...p, [name]: { loading: true } }))
    try {
      const res = await aiService.testProvider(name)
      setProviderTests((p) => ({ ...p, [name]: res }))
    } catch (err) {
      setProviderTests((p) => ({ ...p, [name]: { success: false, message: errorMessage(err, 'Test failed.') } }))
    }
  }

  const s = status.data

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Appearance, your account, system health and the AI gateway." />

      <section className="sheet" aria-labelledby="ap-h">
        <SheetHeader title={<span id="ap-h">Appearance</span>} description="Saved in this browser only." icon={Palette} />
        <div className="px-5 pb-5">
          <ThemePreference />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="sheet" aria-labelledby="acc-h">
          <SheetHeader title={<span id="acc-h">Your account</span>} icon={UserRound} />
          <dl className="px-5 pb-5 grid grid-cols-2 gap-4 text-sm">
            <Meta label="Name">{user?.name}</Meta>
            <Meta label="Role">{user?.role === 'admin' ? 'Administrator' : user?.role}</Meta>
            <Meta label="Email" className="col-span-2">
              {user?.email}
            </Meta>
          </dl>
        </section>

        <section className="sheet" aria-labelledby="sys-h">
          <SheetHeader
            title={<span id="sys-h">System status</span>}
            icon={Server}
            actions={
              <button type="button" className="btn-ghost btn-sm" onClick={status.reload} disabled={status.loading}>
                <RefreshCw className={`w-3.5 h-3.5 ${status.loading ? 'animate-spin' : ''}`} />
                Check again
              </button>
            }
          />
          <div className="px-5 pb-5">
            {status.loading && !s ? (
              <Skeleton className="h-24" />
            ) : status.error ? (
              <ErrorState compact message={status.error} onRetry={status.reload} />
            ) : (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <Meta label="Database">
                  <span className="inline-flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-ink-3" />
                    <Badge status={s.database} />
                  </span>
                </Meta>
                <Meta label="AI gateway">
                  <Badge status={s.freellmapi_status} />
                </Meta>
                <Meta label="Backend version">{s.version}</Meta>
                <Meta label="Environment">{s.environment}</Meta>
                <Meta label="Active faculty">{s.active_faculty}</Meta>
              </dl>
            )}
          </div>
        </section>
      </div>

      {/* AI gateway */}
      <section className="sheet" aria-labelledby="ai-h">
        <SheetHeader
          title={<span id="ai-h">AI gateway (FreeLLMAPI)</span>}
          description="Every AI feature goes browser → SYNCORA server → FreeLLMAPI. Keys never reach the browser."
          icon={Cpu}
          actions={
            <button type="button" className="btn-ghost btn-sm" onClick={config.reload} disabled={config.loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${config.loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          }
        />
        <div className="px-5 pb-5 space-y-6">
          {config.loading && !cfg ? (
            <Skeleton className="h-40" />
          ) : config.error ? (
            <ErrorState message={config.error} onRetry={config.reload} />
          ) : (
            <>
              <div className={`rounded-panel border p-4 ${gw?.available ? 'border-ok/80 bg-ok-soft' : 'border-warn bg-warn-soft'}`}>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {gw?.available ? <CheckCircle2 className="w-5 h-5 text-ok-ink shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-warn-ink shrink-0 mt-0.5" />}
                    <div>
                      <p className="font-semibold text-ink">{gw?.available ? 'Gateway online' : 'Gateway unavailable'}</p>
                      <p className="text-sm text-ink-2">{gw?.message}</p>
                      {!gw?.available && <p className="text-sm text-ink-2 mt-1">SYNCORA keeps working: lesson plans, notifications, the assistant and briefings fall back to rule-based output.</p>}
                    </div>
                  </div>
                  <button type="button" className="btn-primary shrink-0" onClick={testGateway} disabled={testing}>
                    <Zap className={`w-4 h-4 ${testing ? 'animate-pulse' : ''}`} />
                    {testing ? 'Testing…' : 'Test connection'}
                  </button>
                </div>
                {testResult && (
                  <p className={`mt-3 text-sm font-medium ${testResult.success ? 'text-ok-ink' : 'text-danger-ink'}`} role="status">
                    {testResult.success ? 'Connected' : 'Failed'}: {testResult.message}
                    {testResult.telemetry?.latency_ms ? ` (${testResult.telemetry.latency_ms} ms)` : ''}
                  </p>
                )}
              </div>

              <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <Meta label="Base URL">
                  <span className="font-mono text-xs break-all">{gw?.base_url}</span>
                </Meta>
                <Meta label="API key">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                    <KeyRound className="w-3.5 h-3.5 text-ink-3" />
                    {gw?.masked_key || 'Not configured'}
                  </span>
                </Meta>
                <Meta label="Models discovered">{gw?.models_count ?? 0}</Meta>
                <Meta label="Last call latency">{gw?.metrics?.last_latency_ms ? `${gw.metrics.last_latency_ms} ms` : 'No calls yet'}</Meta>
              </dl>

              <form onSubmit={save} className="panel p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-heading font-bold text-ink">Routing and model</p>
                  <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Saving…' : 'Save settings'}
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="Primary provider" htmlFor="ai-primary" hint="FreeLLMAPI is the supported gateway.">
                    <select id="ai-primary" className="input" value={form.primary_provider} onChange={(e) => setForm({ ...form, primary_provider: e.target.value })}>
                      <option value="freellmapi">FreeLLMAPI gateway</option>
                      {(cfg?.providers || [])
                        .filter((p) => p.name !== 'freellmapi')
                        .map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name} (legacy compatibility)
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Fallback provider" htmlFor="ai-fallback" hint="Used only if the primary fails.">
                    <select id="ai-fallback" className="input" value={form.fallback_provider} onChange={(e) => setForm({ ...form, fallback_provider: e.target.value })}>
                      <option value="">None (rule-based fallback)</option>
                      {(cfg?.providers || [])
                        .filter((p) => p.name !== form.primary_provider)
                        .map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Default model" htmlFor="ai-model" hint={models.loading ? 'Discovering models…' : `${modelList.length} available from /v1/models`}>
                    <select id="ai-model" className="input" value={form.default_model} onChange={(e) => setForm({ ...form, default_model: e.target.value })}>
                      <option value="auto">auto (gateway chooses per task)</option>
                      {form.default_model && form.default_model !== 'auto' && !modelList.some((m) => m.id === form.default_model) && <option value={form.default_model}>{form.default_model}</option>}
                      {modelList.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id}
                          {m.owned_by ? ` (${m.owned_by})` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Timeout (seconds)" htmlFor="ai-timeout" hint="Leave blank to keep the current value.">
                    <input id="ai-timeout" type="number" min={5} max={300} className="input" value={form.timeout} onChange={(e) => setForm({ ...form, timeout: e.target.value })} placeholder="60" />
                  </Field>
                  <Field label="Retries on transient errors" htmlFor="ai-retries" hint="Leave blank to keep the current value.">
                    <input id="ai-retries" type="number" min={0} max={5} className="input" value={form.max_retries} onChange={(e) => setForm({ ...form, max_retries: e.target.value })} placeholder="2" />
                  </Field>
                </div>
                <p className="text-xs text-ink-2 flex gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                  Saved values apply to the running server immediately and are recorded in the database. After a server restart, the server's environment file applies again.
                </p>
              </form>

              <div>
                <h3 className="font-heading font-bold text-ink mb-2">Providers and usage</h3>
                <div className="overflow-x-auto rounded-panel border border-line relative">
                  <table className="tbl text-sm min-w-[720px]">
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th className="text-right">Calls</th>
                        <th className="text-right">Succeeded</th>
                        <th className="text-right">Failed</th>
                        <th className="text-right">Tokens in/out</th>
                        <th className="text-right">
                          <span className="sr-only">Test</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cfg?.providers || []).map((p) => {
                        const m = cfg.usage_metrics?.[p.name] || p.metrics || {}
                        const t = providerTests[p.name]
                        return (
                          <tr key={p.name}>
                            <td className="font-semibold text-ink">{p.name}</td>
                            <td className="text-ink-2">{p.is_primary ? 'Primary' : p.is_fallback ? 'Fallback' : 'Standby'}</td>
                            <td>
                              <span className="flex flex-col items-start gap-0.5">
                                <Badge status={p.available ? 'ONLINE' : p.configured ? 'DEGRADED' : 'OFFLINE'} label={p.available ? 'Available' : p.configured ? 'Unreachable' : 'Not configured'} />
                                {t && !t.loading && <span className={`text-xs ${t.success ? 'text-ok-ink' : 'text-danger-ink'}`}>{t.message}</span>}
                              </span>
                            </td>
                            <td className="text-right tabular">{m.calls ?? 0}</td>
                            <td className="text-right tabular">{m.successes ?? 0}</td>
                            <td className="text-right tabular">{m.failures ?? 0}</td>
                            <td className="text-right tabular">
                              {m.prompt_tokens ?? 0}/{m.completion_tokens ?? 0}
                            </td>
                            <td className="text-right">
                              <button type="button" className="btn-ghost btn-sm" onClick={() => testProvider(p.name)} disabled={t?.loading}>
                                {t?.loading ? 'Testing…' : 'Test'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="font-heading font-bold text-ink mb-2">Recent AI errors</h3>
                {(cfg?.recent_errors || []).length === 0 ? (
                  <EmptyState compact icon={CheckCircle2} title="No errors recorded" description="Errors since the server started appear here." />
                ) : (
                  <ul className="divide-y divide-line rounded-panel border border-line max-h-72 overflow-y-auto">
                    {cfg.recent_errors.map((e, i) => (
                      <li key={i} className="px-4 py-3 text-sm">
                        <p className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
                          <span className="chip-neutral">{e.provider}</span>
                          {e.model && <span className="font-mono">{e.model}</span>}
                          <span title={parseTimestamp(e.timestamp)?.toLocaleString()}>
                            {relativeTime(e.timestamp)} ({formatClock(e.timestamp)})
                          </span>
                        </p>
                        <p className="mt-1 text-ink break-words">{e.error}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
