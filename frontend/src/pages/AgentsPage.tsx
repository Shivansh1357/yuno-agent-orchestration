import { useEffect, useState } from 'react'
import { api } from '../api'
import { useMeta } from '../MetaContext'
import type { Agent, AgentInput } from '../types'
import { Chip, EmptyState, ErrorBox, Modal, Spinner, Toggle } from '../components/ui'

const CHANNEL_OPTIONS = ['web', 'telegram']

function emptyDraft(defaultModel: string): AgentInput {
  return {
    name: '',
    role: '',
    system_prompt: '',
    provider: 'anthropic',
    model: defaultModel,
    temperature: 0.7,
    max_tokens: 1024,
    tools: [],
    channels: ['web'],
    skills: [],
    memory_enabled: false,
    max_iterations: 5,
    schedule_cron: null,
    interaction_rules: '',
    guardrails: {},
  }
}

export default function AgentsPage() {
  const { meta } = useMeta()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Agent | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Agent | null>(null)

  const load = () => {
    setLoading(true)
    api
      .listAgents()
      .then((a) => {
        setAgents(a)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const doDelete = async (a: Agent) => {
    try {
      await api.deleteAgent(a.id)
      setConfirmDelete(null)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Agents</h1>
          <p className="muted">Configure autonomous agents — model, tools, guardrails and more.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          + New agent
        </button>
      </header>

      {loading && <Spinner label="Loading agents…" />}
      {error && !loading && <ErrorBox message={error} onRetry={load} />}
      {!loading && !error && agents.length === 0 && (
        <EmptyState
          icon="🤖"
          title="No agents yet"
          hint="Create your first agent to start orchestrating."
          action={
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              + New agent
            </button>
          }
        />
      )}

      <div className="agent-grid">
        {agents.map((a) => (
          <div key={a.id} className="card agent-card">
            <div className="agent-card-head">
              <div className="agent-avatar">{a.name.slice(0, 2).toUpperCase()}</div>
              <div className="agent-id">
                <strong>{a.name}</strong>
                <span className="muted">{a.role || 'No role'}</span>
              </div>
            </div>
            <div className="agent-model muted small mono">{a.model}</div>
            {a.tools.length > 0 && (
              <div className="chip-row">
                {a.tools.slice(0, 4).map((t) => (
                  <Chip key={t} tone="tool">
                    🔧 {t}
                  </Chip>
                ))}
                {a.tools.length > 4 && <Chip>+{a.tools.length - 4}</Chip>}
              </div>
            )}
            <div className="chip-row">
              {a.channels.map((c) => (
                <Chip key={c} tone="channel">
                  {c}
                </Chip>
              ))}
              {a.memory_enabled && <Chip tone="accent">memory</Chip>}
            </div>
            <div className="agent-card-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(a)}>
                Edit
              </button>
              <button className="btn btn-danger-ghost btn-sm" onClick={() => setConfirmDelete(a)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && meta && (
        <AgentEditor
          agent={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      {confirmDelete && (
        <Modal
          title="Delete agent"
          subtitle={confirmDelete.name}
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => doDelete(confirmDelete)}>
                Delete
              </button>
            </>
          }
        >
          <p>
            Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This cannot be
            undone.
          </p>
        </Modal>
      )}
    </div>
  )
}

function AgentEditor({
  agent,
  onClose,
  onSaved,
}: {
  agent: Agent | null
  onClose: () => void
  onSaved: () => void
}) {
  const { meta } = useMeta()
  const models = meta?.models ?? []
  const tools = meta?.tools ?? []

  const [draft, setDraft] = useState<AgentInput>(() =>
    agent
      ? {
          name: agent.name,
          role: agent.role,
          system_prompt: agent.system_prompt,
          provider: agent.provider,
          model: agent.model,
          temperature: agent.temperature,
          max_tokens: agent.max_tokens,
          tools: [...agent.tools],
          channels: [...agent.channels],
          skills: [...agent.skills],
          memory_enabled: agent.memory_enabled,
          max_iterations: agent.max_iterations,
          schedule_cron: agent.schedule_cron,
          interaction_rules: agent.interaction_rules,
          guardrails: { ...agent.guardrails },
        }
      : emptyDraft(meta?.default_model ?? ''),
  )
  const [skillsText, setSkillsText] = useState((agent?.skills ?? []).join(', '))
  const [blockedText, setBlockedText] = useState(
    Array.isArray(agent?.guardrails?.blocked_keywords)
      ? agent!.guardrails.blocked_keywords.join(', ')
      : '',
  )
  const [maxCost, setMaxCost] = useState<string>(
    agent?.guardrails?.max_cost_usd != null ? String(agent.guardrails.max_cost_usd) : '',
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = <K extends keyof AgentInput>(k: K, v: AgentInput[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  const toggleArr = (key: 'tools' | 'channels', val: string) =>
    setDraft((d) => {
      const cur = (d[key] as string[]) ?? []
      return {
        ...d,
        [key]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val],
      }
    })

  const save = async () => {
    if (!draft.name?.trim()) {
      setErr('Name is required.')
      return
    }
    setSaving(true)
    setErr(null)

    const skills = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const blocked = blockedText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const guardrails: Record<string, any> = {}
    if (blocked.length) guardrails.blocked_keywords = blocked
    if (maxCost.trim() && !Number.isNaN(Number(maxCost))) guardrails.max_cost_usd = Number(maxCost)

    const body: AgentInput = {
      ...draft,
      skills,
      guardrails,
      schedule_cron: draft.schedule_cron?.toString().trim() ? draft.schedule_cron : null,
    }

    try {
      if (agent) await api.updateAgent(agent.id, body)
      else await api.createAgent(body)
      onSaved()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={agent ? 'Edit agent' : 'New agent'}
      subtitle={agent ? agent.id : 'Define a new autonomous agent'}
      onClose={onClose}
      wide
      footer={
        <>
          {err && <span className="footer-err">⚠ {err}</span>}
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : agent ? 'Save changes' : 'Create agent'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field">
          <span>Name</span>
          <input value={draft.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field">
          <span>Role</span>
          <input
            value={draft.role ?? ''}
            placeholder="e.g. Research analyst"
            onChange={(e) => set('role', e.target.value)}
          />
        </label>

        <label className="field">
          <span>Model</span>
          <select value={draft.model} onChange={(e) => set('model', e.target.value)}>
            {!models.includes(draft.model ?? '') && draft.model && (
              <option value={draft.model}>{draft.model}</option>
            )}
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Provider</span>
          <input value={draft.provider ?? ''} onChange={(e) => set('provider', e.target.value)} />
        </label>

        <label className="field">
          <span>Temperature · {draft.temperature?.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={draft.temperature ?? 0.7}
            onChange={(e) => set('temperature', Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Max tokens</span>
          <input
            type="number"
            min={1}
            value={draft.max_tokens ?? 1024}
            onChange={(e) => set('max_tokens', Number(e.target.value))}
          />
        </label>

        <label className="field full">
          <span>System prompt</span>
          <textarea
            rows={4}
            value={draft.system_prompt ?? ''}
            placeholder="You are a helpful agent that…"
            onChange={(e) => set('system_prompt', e.target.value)}
          />
        </label>

        <div className="field full">
          <span>Tools</span>
          {tools.length === 0 ? (
            <div className="muted small">No tools advertised by backend.</div>
          ) : (
            <div className="check-grid">
              {tools.map((t) => (
                <label key={t} className="check">
                  <input
                    type="checkbox"
                    checked={(draft.tools ?? []).includes(t)}
                    onChange={() => toggleArr('tools', t)}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <span>Channels</span>
          <div className="check-grid">
            {CHANNEL_OPTIONS.map((c) => (
              <label key={c} className="check">
                <input
                  type="checkbox"
                  checked={(draft.channels ?? []).includes(c)}
                  onChange={() => toggleArr('channels', c)}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Skills (comma separated)</span>
          <input
            value={skillsText}
            placeholder="summarize, classify"
            onChange={(e) => setSkillsText(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Max iterations</span>
          <input
            type="number"
            min={1}
            value={draft.max_iterations ?? 5}
            onChange={(e) => set('max_iterations', Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Schedule (cron)</span>
          <input
            value={draft.schedule_cron ?? ''}
            placeholder="*/30 * * * *"
            onChange={(e) => set('schedule_cron', e.target.value || null)}
          />
        </label>

        <label className="field full">
          <span>Interaction rules</span>
          <textarea
            rows={2}
            value={draft.interaction_rules ?? ''}
            placeholder="How this agent collaborates with others…"
            onChange={(e) => set('interaction_rules', e.target.value)}
          />
        </label>

        <div className="field full">
          <span>Memory</span>
          <Toggle
            checked={!!draft.memory_enabled}
            onChange={(v) => set('memory_enabled', v)}
            label="Enable persistent memory across runs"
          />
        </div>

        <div className="field full subsection">
          <span className="subsection-title">Guardrails</span>
        </div>
        <label className="field">
          <span>Blocked keywords (comma separated)</span>
          <input
            value={blockedText}
            placeholder="password, ssn"
            onChange={(e) => setBlockedText(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Max cost (USD)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={maxCost}
            placeholder="1.00"
            onChange={(e) => setMaxCost(e.target.value)}
          />
        </label>
      </div>
    </Modal>
  )
}
