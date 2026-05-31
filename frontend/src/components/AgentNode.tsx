import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Agent } from '../types'

export interface AgentNodeData extends Record<string, unknown> {
  label: string
  agentId: string
  isEntry: boolean
  agents: Agent[]
  onPickAgent: (nodeId: string, agentId: string) => void
  onSetEntry: (nodeId: string) => void
}

export default function AgentNode({ id, data, selected }: NodeProps) {
  const d = data as AgentNodeData
  const agent = d.agents.find((a) => a.id === d.agentId)

  return (
    <div className={`flow-node ${d.isEntry ? 'is-entry' : ''} ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="flow-handle" />
      <div className="flow-node-head">
        <span className="flow-node-icon">🤖</span>
        <span className="flow-node-title">{agent?.name ?? d.label ?? 'Unbound'}</span>
        {d.isEntry && <span className="entry-tag">entry</span>}
      </div>
      <select
        className="nodrag flow-node-select"
        value={d.agentId}
        onChange={(e) => d.onPickAgent(id, e.target.value)}
      >
        <option value="">— bind agent —</option>
        {d.agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <div className="flow-node-foot">
        {agent ? (
          <span className="muted mono">{agent.model}</span>
        ) : (
          <span className="muted">no agent</span>
        )}
        {!d.isEntry && (
          <button className="nodrag mini-link" onClick={() => d.onSetEntry(id)}>
            set entry
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="flow-handle" />
    </div>
  )
}
