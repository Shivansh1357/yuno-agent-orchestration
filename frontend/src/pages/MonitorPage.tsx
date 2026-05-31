import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { useMonitor } from '../useMonitor'
import { useMeta } from '../MetaContext'
import type { Agent, Message, Run, Workflow } from '../types'
import { Chip, EmptyState, ErrorBox, Spinner, StatusBadge } from '../components/ui'
import { fmtCost, fmtTime, fmtTokens, truncate } from '../format'

const TYPE_META: Record<Message['type'], { label: string; icon: string }> = {
  log: { label: 'log', icon: '•' },
  agent: { label: 'agent', icon: '🤖' },
  tool: { label: 'tool', icon: '🔧' },
  error: { label: 'error', icon: '⚠' },
  chat: { label: 'chat', icon: '💬' },
}

export default function MonitorPage() {
  const { meta } = useMeta()
  const { messages, totals, conn, clear } = useMonitor()

  const [agents, setAgents] = useState<Agent[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [runs, setRuns] = useState<Run[]>([])

  const [target, setTarget] = useState('') // "wf:<id>" | "ag:<id>"
  const [taskInput, setTaskInput] = useState('')
  const [triggering, setTriggering] = useState(false)
  const [triggerErr, setTriggerErr] = useState<string | null>(null)

  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [runMessages, setRunMessages] = useState<Message[] | null>(null)
  const [runMsgLoading, setRunMsgLoading] = useState(false)

  const feedRef = useRef<HTMLDivElement>(null)
  const autoScroll = useRef(true)

  // Load selectable agents/workflows once
  useEffect(() => {
    api.listAgents().then(setAgents).catch(() => {})
    api.listWorkflows().then(setWorkflows).catch(() => {})
  }, [])

  // Poll runs every 3s
  useEffect(() => {
    let alive = true
    const load = () => api.listRuns().then((r) => alive && setRuns(r)).catch(() => {})
    load()
    const t = setInterval(load, 3000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  // Auto-scroll feed
  useEffect(() => {
    if (autoScroll.current && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [messages, runMessages, selectedRun])

  const onFeedScroll = () => {
    const el = feedRef.current
    if (!el) return
    autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  const triggerRun = async () => {
    if (!target || !taskInput.trim()) return
    setTriggering(true)
    setTriggerErr(null)
    try {
      const [kind, id] = target.split(':')
      await api.createRun({
        input: taskInput.trim(),
        ...(kind === 'wf' ? { workflow_id: id } : { agent_id: id }),
        trigger: 'manual',
      })
      setTaskInput('')
      autoScroll.current = true
      const r = await api.listRuns()
      setRuns(r)
    } catch (e) {
      setTriggerErr((e as Error).message)
    } finally {
      setTriggering(false)
    }
  }

  const selectRun = async (id: string) => {
    if (selectedRun === id) {
      setSelectedRun(null)
      setRunMessages(null)
      return
    }
    setSelectedRun(id)
    setRunMsgLoading(true)
    autoScroll.current = true
    try {
      const m = await api.listMessages({ run_id: id, limit: 500 })
      setRunMessages(m)
    } catch {
      setRunMessages([])
    } finally {
      setRunMsgLoading(false)
    }
  }

  // While a run is selected, refresh its messages as live ones arrive for it
  useEffect(() => {
    if (!selectedRun) return
    const live = messages.filter((m) => m.run_id === selectedRun)
    if (live.length === 0) return
    setRunMessages((prev) => {
      if (!prev) return prev
      const known = new Set(prev.map((m) => m.id))
      const add = live.filter((m) => !known.has(m.id))
      return add.length ? [...prev, ...add] : prev
    })
  }, [messages, selectedRun])

  const feed = selectedRun ? runMessages ?? [] : messages

  const connLabel = useMemo(() => {
    if (conn === 'open') return { t: 'live', cls: 'on' }
    if (conn === 'connecting') return { t: 'connecting', cls: 'mid' }
    return { t: 'reconnecting', cls: 'off' }
  }, [conn])

  const agentName = (id: string | null) => agents.find((a) => a.id === id)?.name
  const wfName = (id: string | null) => workflows.find((w) => w.id === id)?.name

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Monitor</h1>
          <p className="muted">Live event stream across all agents, tools and runs.</p>
        </div>
        <div className={`conn-indicator conn-${connLabel.cls}`}>
          <span className="pill-dot" /> {connLabel.t}
        </div>
      </header>

      <div className="monitor-grid">
        {/* Left: feed */}
        <section className="card feed-card">
          <div className="card-head">
            <h3>
              {selectedRun ? (
                <>
                  Run feed{' '}
                  <span className="muted mono">{truncate(selectedRun, 8)}</span>
                </>
              ) : (
                'Live event feed'
              )}
            </h3>
            <div className="row gap-sm">
              {selectedRun && (
                <button className="btn btn-ghost btn-sm" onClick={() => selectRun(selectedRun)}>
                  ← All events
                </button>
              )}
              {!selectedRun && (
                <button className="btn btn-ghost btn-sm" onClick={clear}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="feed" ref={feedRef} onScroll={onFeedScroll}>
            {runMsgLoading && <Spinner label="Loading run messages…" />}
            {!runMsgLoading && feed.length === 0 && (
              <EmptyState
                icon="📡"
                title="Waiting for events"
                hint="Trigger a run to watch agents collaborate in real time."
              />
            )}
            {feed.map((m, i) => {
              const tm = TYPE_META[m.type]
              const hasCost = m.cost_usd > 0 || m.input_tokens > 0 || m.output_tokens > 0
              const delay = Math.min(i, 14) * 18
              return (
                <div
                  key={m.id}
                  className={`event event-${m.type}`}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <div className="event-rail" />
                  <div className="event-body">
                    <div className="event-top">
                      <span className="event-icon">{tm.icon}</span>
                      <span className="event-route">
                        <strong>{m.sender}</strong>
                        {m.recipient && (
                          <>
                            {' '}
                            <span className="arrow">→</span> {m.recipient}
                          </>
                        )}
                      </span>
                      <span className={`type-tag type-${m.type}`}>{tm.label}</span>
                      <span className="event-time muted">{fmtTime(m.created_at)}</span>
                    </div>
                    <div className="event-content">{m.content}</div>
                    {hasCost && (
                      <div className="event-meta muted">
                        {(m.input_tokens > 0 || m.output_tokens > 0) && (
                          <span>
                            {fmtTokens(m.input_tokens)} in · {fmtTokens(m.output_tokens)} out
                          </span>
                        )}
                        {m.cost_usd > 0 && <span>{fmtCost(m.cost_usd)}</span>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Right column */}
        <div className="monitor-side">
          {/* Trigger panel */}
          <section className="card">
            <div className="card-head">
              <h3>Trigger a run</h3>
            </div>
            <div className="stack">
              <label className="field">
                <span>Target</span>
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Select workflow or agent…</option>
                  {workflows.length > 0 && (
                    <optgroup label="Workflows">
                      {workflows.map((w) => (
                        <option key={w.id} value={`wf:${w.id}`}>
                          🕸 {w.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {agents.length > 0 && (
                    <optgroup label="Agents">
                      {agents.map((a) => (
                        <option key={a.id} value={`ag:${a.id}`}>
                          🤖 {a.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              <label className="field">
                <span>Task input</span>
                <textarea
                  rows={3}
                  placeholder="What should the agent(s) do?"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                />
              </label>
              {triggerErr && <ErrorBox message={triggerErr} />}
              {meta && !meta.llm_enabled && (
                <div className="muted small">LLM is not configured — runs may fail.</div>
              )}
              <button
                className="btn btn-primary"
                disabled={!target || !taskInput.trim() || triggering}
                onClick={triggerRun}
              >
                {triggering ? 'Starting…' : '▶ Run'}
              </button>
            </div>
          </section>

          {/* Session tally */}
          <section className="card">
            <div className="card-head">
              <h3>Session totals</h3>
            </div>
            <div className="tally">
              <div className="tally-item">
                <span className="tally-val">{fmtTokens(totals.inputTokens)}</span>
                <span className="muted">input tokens</span>
              </div>
              <div className="tally-item">
                <span className="tally-val">{fmtTokens(totals.outputTokens)}</span>
                <span className="muted">output tokens</span>
              </div>
              <div className="tally-item">
                <span className="tally-val accent">{fmtCost(totals.costUsd)}</span>
                <span className="muted">cost</span>
              </div>
            </div>
          </section>

          {/* Recent runs */}
          <section className="card recent-card">
            <div className="card-head">
              <h3>Recent runs</h3>
              <span className="muted small">{runs.length}</span>
            </div>
            <div className="run-list">
              {runs.length === 0 && (
                <EmptyState title="No runs yet" hint="Triggered runs appear here." />
              )}
              {runs.map((r) => {
                const name = wfName(r.workflow_id) ?? agentName(r.agent_id) ?? 'unknown'
                return (
                  <button
                    key={r.id}
                    className={`run-row ${selectedRun === r.id ? 'selected' : ''}`}
                    onClick={() => selectRun(r.id)}
                  >
                    <div className="run-row-top">
                      <StatusBadge status={r.status} />
                      <span className="run-name">{name}</span>
                      <Chip>{r.trigger}</Chip>
                    </div>
                    <div className="run-snippet muted">{truncate(r.input, 80)}</div>
                    <div className="run-row-meta muted small">
                      <span>
                        {fmtTokens(r.total_input_tokens)}/{fmtTokens(r.total_output_tokens)} tok
                      </span>
                      <span>{fmtCost(r.total_cost_usd)}</span>
                      <span>{fmtTime(r.started_at)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
