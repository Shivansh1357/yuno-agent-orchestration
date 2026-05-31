import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api'
import type { Agent, Workflow } from '../types'
import { Chip, EmptyState, ErrorBox, Modal, Spinner } from '../components/ui'
import { ArrowRight, Circle, Plus, STROKE, Trash2, WorkflowIcon } from '../icons'
import { hoverLift, tapScale } from '../motion'
import { fmtDate } from '../format'
import WorkflowBuilder from '../components/WorkflowBuilder'

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Workflow | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Workflow | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([api.listWorkflows(), api.listAgents()])
      .then(([w, a]) => {
        setWorkflows(w)
        setAgents(a)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const createNew = async () => {
    if (!newName.trim()) return
    try {
      const wf = await api.createWorkflow({
        name: newName.trim(),
        description: '',
        graph: { entry: '', nodes: [], edges: [] },
      })
      setCreating(false)
      setNewName('')
      setWorkflows((prev) => [...prev, wf])
      setOpen(wf)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const doDelete = async (w: Workflow) => {
    try {
      await api.deleteWorkflow(w.id)
      setConfirmDelete(null)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (open) {
    return (
      <WorkflowBuilder
        workflow={open === 'new' ? null : open}
        agents={agents}
        onBack={() => {
          setOpen(null)
          load()
        }}
        onSaved={(saved) => {
          setWorkflows((prev) => {
            const exists = prev.some((w) => w.id === saved.id)
            return exists ? prev.map((w) => (w.id === saved.id ? saved : w)) : [...prev, saved]
          })
          setOpen(saved)
        }}
      />
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Workflows</h1>
          <p className="muted">Compose multi-agent graphs with conditional routing.</p>
        </div>
        <motion.button
          className="btn btn-primary"
          onClick={() => setCreating(true)}
          whileTap={tapScale}
        >
          <Plus size={15} strokeWidth={STROKE} /> New workflow
        </motion.button>
      </header>

      {loading && <Spinner label="Loading workflows…" />}
      {error && !loading && <ErrorBox message={error} onRetry={load} />}
      {!loading && !error && workflows.length === 0 && (
        <EmptyState
          icon={<WorkflowIcon size={28} strokeWidth={STROKE} />}
          title="No workflows yet"
          hint="Build a graph of agents that pass work between each other."
          action={
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={15} strokeWidth={STROKE} /> New workflow
            </button>
          }
        />
      )}

      <div className="wf-grid">
        {workflows.map((w, i) => (
          <motion.div
            key={w.id}
            className="card wf-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 12) * 0.035 }}
            whileHover={hoverLift}
          >
            <div className="wf-card-head">
              <strong>{w.name}</strong>
              {w.is_template && <Chip tone="accent">template</Chip>}
            </div>
            <p className="muted wf-desc">{w.description || 'No description.'}</p>
            <div className="wf-stats muted small">
              <span>
                <Circle size={11} strokeWidth={STROKE} /> {w.graph.nodes.length} nodes
              </span>
              <span>
                <ArrowRight size={12} strokeWidth={STROKE} /> {w.graph.edges.length} edges
              </span>
              <span>{fmtDate(w.updated_at)}</span>
            </div>
            <div className="agent-card-actions">
              <button className="btn btn-primary btn-sm" onClick={() => setOpen(w)}>
                Open builder
              </button>
              <button className="btn btn-danger-ghost btn-sm" onClick={() => setConfirmDelete(w)}>
                <Trash2 size={14} strokeWidth={STROKE} /> Delete
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {creating && (
        <Modal
          title="New workflow"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={createNew} disabled={!newName.trim()}>
                Create & open
              </button>
            </>
          }
        >
          <label className="field">
            <span>Name</span>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createNew()}
              placeholder="Research → Draft → Review"
            />
          </label>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="Delete workflow"
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
            Delete <strong>{confirmDelete.name}</strong>? This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}
