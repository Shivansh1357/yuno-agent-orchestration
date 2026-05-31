import type {
  Agent,
  AgentInput,
  ChatInput,
  ChatResponse,
  Message,
  Meta,
  Run,
  RunInput,
  Workflow,
  WorkflowInput,
} from './types'

export const API = import.meta.env.VITE_API_BASE ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      // ignore parse errors
    }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  // Meta
  getMeta: () => request<Meta>('/api/meta'),

  // Agents
  listAgents: () => request<Agent[]>('/api/agents'),
  getAgent: (id: string) => request<Agent>(`/api/agents/${id}`),
  createAgent: (body: AgentInput) =>
    request<Agent>('/api/agents', { method: 'POST', body: JSON.stringify(body) }),
  updateAgent: (id: string, body: AgentInput) =>
    request<Agent>(`/api/agents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAgent: (id: string) => request<void>(`/api/agents/${id}`, { method: 'DELETE' }),

  // Workflows
  listWorkflows: () => request<Workflow[]>('/api/workflows'),
  getWorkflow: (id: string) => request<Workflow>(`/api/workflows/${id}`),
  createWorkflow: (body: WorkflowInput) =>
    request<Workflow>('/api/workflows', { method: 'POST', body: JSON.stringify(body) }),
  updateWorkflow: (id: string, body: Partial<WorkflowInput>) =>
    request<Workflow>(`/api/workflows/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWorkflow: (id: string) => request<void>(`/api/workflows/${id}`, { method: 'DELETE' }),

  // Runs
  listRuns: () => request<Run[]>('/api/runs'),
  getRun: (id: string) => request<Run>(`/api/runs/${id}`),
  createRun: (body: RunInput) =>
    request<Run>('/api/runs', { method: 'POST', body: JSON.stringify(body) }),

  // Chat
  chat: (body: ChatInput) =>
    request<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify(body) }),

  // Messages
  listMessages: (params: { run_id?: string; channel?: string; type?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params.run_id) q.set('run_id', params.run_id)
    if (params.channel) q.set('channel', params.channel)
    if (params.type) q.set('type', params.type)
    if (params.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return request<Message[]>(`/api/messages${qs ? `?${qs}` : ''}`)
  },
}

export function wsUrl(path: string): string {
  if (API) {
    return API.replace(/^http/, 'ws') + path
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}${path}`
}
