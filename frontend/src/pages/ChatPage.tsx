import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useMeta } from '../MetaContext'
import type { Agent, Message } from '../types'
import { EmptyState, ErrorBox, Spinner } from '../components/ui'
import { fmtCost, fmtTokens } from '../format'

interface Bubble {
  id: string
  role: 'user' | 'agent'
  text: string
  cost?: number
  inTok?: number
  outTok?: number
  pending?: boolean
}

function sessionRef(agentId: string) {
  return `web-${agentId}`
}

export default function ChatPage() {
  const { meta } = useMeta()
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentId, setAgentId] = useState('')
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .listAgents()
      .then((a) => {
        setAgents(a)
        if (a.length && !agentId) setAgentId(a[0].id)
      })
      .catch((e: Error) => setErr(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load prior turns for the selected agent's web session
  useEffect(() => {
    if (!agentId) return
    let alive = true
    setLoadingHistory(true)
    setErr(null)
    const ref = sessionRef(agentId)
    api
      .listMessages({ channel: 'web', limit: 200 })
      .then((msgs: Message[]) => {
        if (!alive) return
        const mine = msgs.filter(
          (m) =>
            (m.meta?.session_ref === ref ||
              m.sender === ref ||
              m.recipient === ref ||
              m.meta?.agent_id === agentId) &&
            (m.type === 'chat' || m.type === 'agent'),
        )
        const turns: Bubble[] = mine.map((m) => ({
          id: m.id,
          role: m.type === 'chat' ? 'user' : 'agent',
          text: m.content,
          cost: m.cost_usd || undefined,
          inTok: m.input_tokens || undefined,
          outTok: m.output_tokens || undefined,
        }))
        setBubbles(turns)
      })
      .catch(() => setBubbles([]))
      .finally(() => alive && setLoadingHistory(false))
    return () => {
      alive = false
    }
  }, [agentId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [bubbles, sending])

  const send = async () => {
    const t = text.trim()
    if (!t || !agentId || sending) return
    setText('')
    setErr(null)
    const userBubble: Bubble = { id: `u-${Date.now()}`, role: 'user', text: t }
    const pendingId = `p-${Date.now()}`
    setBubbles((b) => [...b, userBubble, { id: pendingId, role: 'agent', text: '', pending: true }])
    setSending(true)
    try {
      const res = await api.chat({ text: t, agent_id: agentId, session_ref: sessionRef(agentId) })
      setBubbles((b) =>
        b.map((x) =>
          x.id === pendingId
            ? {
                id: `a-${Date.now()}`,
                role: 'agent',
                text: res.reply,
                cost: res.cost_usd,
                inTok: res.input_tokens,
                outTok: res.output_tokens,
              }
            : x,
        ),
      )
    } catch (e) {
      setBubbles((b) => b.filter((x) => x.id !== pendingId))
      setErr((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const currentAgent = agents.find((a) => a.id === agentId)

  return (
    <div className="page chat-page">
      <header className="page-head">
        <div>
          <h1>Chat</h1>
          <p className="muted">Talk directly to a single agent.</p>
        </div>
        <label className="field inline">
          <span>Agent</span>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            {agents.length === 0 && <option value="">No agents</option>}
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {meta && !meta.llm_enabled && (
        <div className="banner banner-warn inline-banner">
          LLM not configured — replies will fail until <code>ANTHROPIC_API_KEY</code> is set.
        </div>
      )}

      <div className="card chat-card">
        <div className="chat-scroll" ref={scrollRef}>
          {loadingHistory && <Spinner label="Loading history…" />}
          {!loadingHistory && bubbles.length === 0 && (
            <EmptyState
              icon="💬"
              title={currentAgent ? `Say hi to ${currentAgent.name}` : 'Select an agent'}
              hint={currentAgent?.role || 'Start a conversation below.'}
            />
          )}
          {bubbles.map((b) => (
            <div key={b.id} className={`bubble-row ${b.role}`}>
              {b.role === 'agent' && (
                <div className="bubble-avatar">
                  {(currentAgent?.name ?? 'A').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className={`bubble bubble-${b.role}`}>
                {b.pending ? (
                  <span className="thinking">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                    agent is thinking…
                  </span>
                ) : (
                  <span className="bubble-text">{b.text}</span>
                )}
                {!b.pending && (b.cost != null || b.inTok != null) && (
                  <div className="bubble-foot muted">
                    {(b.inTok || b.outTok) && (
                      <span>
                        {fmtTokens(b.inTok ?? 0)} in · {fmtTokens(b.outTok ?? 0)} out
                      </span>
                    )}
                    {b.cost != null && <span>{fmtCost(b.cost)}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {err && (
          <div className="chat-err">
            <ErrorBox message={err} />
          </div>
        )}

        <div className="chat-composer">
          <textarea
            rows={1}
            placeholder={agentId ? 'Message the agent…' : 'Select an agent first'}
            value={text}
            disabled={!agentId}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          <button
            className="btn btn-primary"
            onClick={send}
            disabled={!agentId || !text.trim() || sending}
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
