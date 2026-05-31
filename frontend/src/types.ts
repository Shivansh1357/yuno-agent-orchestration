// Type definitions mirroring the backend API contract.

export interface Agent {
  id: string
  name: string
  role: string
  system_prompt: string
  provider: string
  model: string
  temperature: number
  max_tokens: number
  tools: string[]
  channels: string[]
  skills: string[]
  memory_enabled: boolean
  max_iterations: number
  schedule_cron: string | null
  interaction_rules: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  guardrails: Record<string, any>
  created_at: string
  updated_at: string
}

export interface WorkflowNode {
  id: string
  agent_id: string
  label?: string
}

export interface WorkflowEdge {
  source: string
  target: string
  condition?: string
}

export interface WorkflowGraph {
  entry: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface Workflow {
  id: string
  name: string
  description: string
  graph: WorkflowGraph
  is_template: boolean
  created_at: string
  updated_at: string
}

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Run {
  id: string
  workflow_id: string | null
  agent_id: string | null
  status: RunStatus
  trigger: string
  channel_ref: string | null
  input: string
  output: string
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  error: string | null
  started_at: string
  finished_at: string | null
}

export type MessageType = 'chat' | 'agent' | 'tool' | 'log' | 'error'

export interface Message {
  id: string
  run_id: string | null
  type: MessageType
  sender: string
  recipient: string
  channel: string | null
  content: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta: Record<string, any>
  input_tokens: number
  output_tokens: number
  cost_usd: number
  created_at: string
}

export interface Meta {
  tools: string[]
  models: string[]
  default_model: string
  llm_enabled: boolean
  telegram_enabled: boolean
  channels: string[]
}

export interface ChatResponse {
  reply: string
  cost_usd: number
  input_tokens: number
  output_tokens: number
}

// WebSocket monitor events
export interface MonitorHello {
  kind: 'hello'
  [key: string]: unknown
}

export interface MonitorMessageEvent extends Message {
  kind: 'message'
}

export interface MonitorRunStatusEvent {
  kind: 'run_status'
  run_id: string
  status: RunStatus
}

export type MonitorEvent = MonitorHello | MonitorMessageEvent | MonitorRunStatusEvent

// Payload shapes
export type AgentInput = Partial<Omit<Agent, 'id' | 'created_at' | 'updated_at'>>

export interface WorkflowInput {
  name: string
  description?: string
  graph: WorkflowGraph
  is_template?: boolean
}

export interface RunInput {
  workflow_id?: string
  agent_id?: string
  input: string
  trigger?: string
}

export interface ChatInput {
  text: string
  agent_id: string
  session_ref?: string
}
