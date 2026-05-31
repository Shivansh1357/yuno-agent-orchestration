import { useCallback, useMemo, useRef, useState } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnect,
} from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Agent, Workflow, WorkflowGraph } from '../types'
import AgentNode, { type AgentNodeData } from './AgentNode'
import { ErrorBox } from './ui'

let nodeSeq = 0
function newNodeId() {
  nodeSeq += 1
  return `n${Date.now().toString(36)}${nodeSeq}`
}

const nodeTypes: NodeTypes = { agent: AgentNode }

interface Props {
  workflow: Workflow | null
  agents: Agent[]
  onBack: () => void
  onSaved: (w: Workflow) => void
}

function graphToFlow(graph: WorkflowGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n, i) => ({
    id: n.id,
    type: 'agent',
    position: { x: 60 + (i % 3) * 280, y: 80 + Math.floor(i / 3) * 180 },
    data: { label: n.label ?? '', agentId: n.agent_id ?? '' } as Partial<AgentNodeData>,
  }))
  const edges: Edge[] = graph.edges.map((e, i) => ({
    id: `e${i}-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    label: e.condition || undefined,
    type: 'smoothstep',
    animated: true,
  }))
  return { nodes, edges }
}

function BuilderInner({ workflow, agents, onBack, onSaved }: Props) {
  const navigate = useNavigate()
  const initial = useMemo(
    () => graphToFlow(workflow?.graph ?? { entry: '', nodes: [], edges: [] }),
    [workflow],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges)
  const [entry, setEntry] = useState<string>(workflow?.graph.entry ?? '')
  const [name, setName] = useState(workflow?.name ?? 'Untitled workflow')
  const [description, setDescription] = useState(workflow?.description ?? '')
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const wfId = useRef(workflow?.id ?? null)

  const markDirty = () => setDirty(true)

  const pickAgent = useCallback(
    (nodeId: string, agentId: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, agentId } } : n,
        ),
      )
      markDirty()
    },
    [setNodes],
  )

  const onSetEntry = useCallback((nodeId: string) => {
    setEntry(nodeId)
    markDirty()
  }, [])

  // Inject live handlers + entry flag into node data for the custom node renderer
  const decoratedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          agents,
          isEntry: n.id === entry,
          onPickAgent: pickAgent,
          onSetEntry,
        } as AgentNodeData,
      })),
    [nodes, agents, entry, pickAgent, onSetEntry],
  )

  const onConnect: OnConnect = useCallback(
    (conn: Connection) => {
      setEdges((eds) =>
        addEdge({ ...conn, type: 'smoothstep', animated: true, label: 'always' }, eds),
      )
      markDirty()
    },
    [setEdges],
  )

  const addNode = () => {
    const id = newNodeId()
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'agent',
        position: { x: 120 + Math.random() * 220, y: 120 + Math.random() * 160 },
        data: { label: '', agentId: agents[0]?.id ?? '' } as Partial<AgentNodeData>,
      },
    ])
    if (!entry) setEntry(id)
    markDirty()
  }

  const deleteSelected = () => {
    setNodes((nds) => {
      const remaining = nds.filter((n) => !n.selected)
      const removedIds = new Set(nds.filter((n) => n.selected).map((n) => n.id))
      if (removedIds.has(entry)) setEntry(remaining[0]?.id ?? '')
      setEdges((eds) =>
        eds.filter(
          (e) => !e.selected && !removedIds.has(e.source) && !removedIds.has(e.target),
        ),
      )
      return remaining
    })
    setSelectedEdge(null)
    markDirty()
  }

  const setEdgeCondition = (cond: string) => {
    if (!selectedEdge) return
    setEdges((eds) =>
      eds.map((e) =>
        e.id === selectedEdge.id ? { ...e, label: cond || undefined } : e,
      ),
    )
    setSelectedEdge((prev) => (prev ? { ...prev, label: cond || undefined } : prev))
    markDirty()
  }

  const serialize = (): WorkflowGraph => ({
    entry,
    nodes: nodes.map((n) => {
      const d = n.data as Partial<AgentNodeData>
      const agent = agents.find((a) => a.id === d.agentId)
      return {
        id: n.id,
        agent_id: d.agentId ?? '',
        label: agent?.name ?? (d.label as string) ?? '',
      }
    }),
    edges: edges.map((e) => ({
      source: e.source,
      target: e.target,
      condition: typeof e.label === 'string' && e.label ? e.label : 'always',
    })),
  })

  const save = async () => {
    setSaving(true)
    setErr(null)
    const graph = serialize()
    try {
      let saved: Workflow
      if (wfId.current) {
        saved = await api.updateWorkflow(wfId.current, { name, description, graph })
      } else {
        saved = await api.createWorkflow({ name, description, graph })
        wfId.current = saved.id
      }
      setDirty(false)
      onSaved(saved)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const runWorkflow = async () => {
    if (dirty || !wfId.current) {
      await save()
    }
    if (!wfId.current) return
    const input = window.prompt('Task input for this workflow run:')
    if (input == null || !input.trim()) return
    try {
      await api.createRun({ workflow_id: wfId.current, input: input.trim(), trigger: 'manual' })
      navigate('/')
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const hasUnbound = nodes.some((n) => !(n.data as Partial<AgentNodeData>).agentId)

  return (
    <div className="page builder-page">
      <header className="page-head builder-head">
        <div className="builder-title">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            ← Back
          </button>
          <input
            className="title-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              markDirty()
            }}
          />
          {dirty && <span className="dirty-dot" title="Unsaved changes" />}
        </div>
        <div className="row gap-sm">
          <button className="btn btn-ghost" onClick={addNode}>
            + Node
          </button>
          <button className="btn btn-ghost" onClick={deleteSelected}>
            Delete selected
          </button>
          <button className="btn btn-secondary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn btn-primary" onClick={runWorkflow} disabled={nodes.length === 0}>
            ▶ Run workflow
          </button>
        </div>
      </header>

      {err && <ErrorBox message={err} onRetry={() => setErr(null)} />}

      <div className="builder-body">
        <div className="flow-wrap">
          <ReactFlow
            nodes={decoratedNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(c) => {
              onNodesChange(c)
              if (c.some((x) => x.type === 'position' || x.type === 'remove')) markDirty()
            }}
            onEdgesChange={(c) => {
              onEdgesChange(c)
              if (c.some((x) => x.type === 'remove')) markDirty()
            }}
            onConnect={onConnect}
            onEdgeClick={(_, edge) => setSelectedEdge(edge)}
            onPaneClick={() => setSelectedEdge(null)}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a2a40" />
            <Controls />
            <MiniMap pannable zoomable className="flow-minimap" />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="flow-overlay-hint">
              <div>
                <strong>Empty canvas</strong>
                <p className="muted">Click “+ Node” to add an agent, then drag between handles to connect them.</p>
              </div>
            </div>
          )}
        </div>

        <aside className="builder-panel">
          <section className="panel-block">
            <h4>Workflow</h4>
            <label className="field">
              <span>Description</span>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  markDirty()
                }}
                placeholder="What does this workflow do?"
              />
            </label>
            <div className="field">
              <span>Entry node</span>
              <select
                value={entry}
                onChange={(e) => {
                  setEntry(e.target.value)
                  markDirty()
                }}
              >
                <option value="">— none —</option>
                {nodes.map((n) => {
                  const a = agents.find((x) => x.id === (n.data as Partial<AgentNodeData>).agentId)
                  return (
                    <option key={n.id} value={n.id}>
                      {a?.name ?? n.id}
                    </option>
                  )
                })}
              </select>
            </div>
          </section>

          <section className="panel-block">
            <h4>Edge condition</h4>
            {selectedEdge ? (
              <>
                <p className="muted small">
                  {selectedEdge.source} → {selectedEdge.target}
                </p>
                <input
                  value={typeof selectedEdge.label === 'string' ? selectedEdge.label : ''}
                  placeholder="always"
                  onChange={(e) => setEdgeCondition(e.target.value)}
                />
                <div className="cond-hints">
                  {['always', 'contains:WORD', 'not_contains:WORD'].map((h) => (
                    <button key={h} className="hint-chip" onClick={() => setEdgeCondition(h)}>
                      {h}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted small">Click an edge to edit its routing condition.</p>
            )}
          </section>

          <section className="panel-block legend">
            <h4>Legend</h4>
            <ul>
              <li>
                <code>always</code> — follow this edge every time.
              </li>
              <li>
                <code>contains:WORD</code> — only if output contains WORD.
              </li>
              <li>
                <code>not_contains:WORD</code> — only if output lacks WORD.
              </li>
              <li>
                A <strong>back-edge</strong> (target earlier than source) forms a feedback loop.
              </li>
            </ul>
            {hasUnbound && (
              <p className="warn-text small">⚠ Some nodes have no agent bound.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

export default function WorkflowBuilder(props: Props) {
  return (
    <ReactFlowProvider>
      <BuilderInner {...props} />
    </ReactFlowProvider>
  )
}
