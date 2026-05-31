// Centralised Lucide icon usage. Consistent stroke width (1.75) and sizing.
import {
  AlertTriangle,
  Bot,
  Brain,
  Calculator,
  CheckCircle2,
  Circle,
  Clock,
  Database,
  Globe,
  Link as LinkIcon,
  Loader,
  MessageCircle,
  Search,
  Send,
  Terminal,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { MessageType, RunStatus } from './types'

export const STROKE = 1.75

// Re-export the icons used directly in components so call-sites import from one place.
export {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  Circle,
  Coins,
  DollarSign,
  Hexagon,
  Loader,
  MessagesSquare,
  Radio,
  Wrench,
  XCircle,
} from 'lucide-react'
export {
  ArrowLeft,
  ArrowRight,
  Flag,
  Hash,
  Pencil,
  Play,
  Plus,
  Save,
  SendHorizontal,
  Trash2,
  Workflow as WorkflowIcon,
  X,
} from 'lucide-react'

// Event-type icon mapping (semantic colours stay in CSS).
export const EVENT_ICON: Record<MessageType, LucideIcon> = {
  log: Terminal,
  agent: Bot,
  tool: Wrench,
  error: AlertTriangle,
  chat: MessageCircle,
}

// Run-status icon mapping.
export const STATUS_ICON: Record<RunStatus, LucideIcon> = {
  pending: Circle,
  running: Loader,
  completed: CheckCircle2,
  failed: XCircle,
}

// Tool chip icon mapping. Falls back to Wrench.
export function toolIcon(name: string): LucideIcon {
  const n = name.toLowerCase()
  if (n.includes('calc')) return Calculator
  if (n.includes('search') || n.includes('web')) return Search
  if (n.includes('http') || n.includes('url') || n.includes('fetch')) return LinkIcon
  if (n.includes('time') || n.includes('date') || n.includes('clock')) return Clock
  if (n.includes('memory') || n.includes('remember') || n.includes('recall')) return Brain
  if (n.includes('db') || n.includes('database') || n.includes('store')) return Database
  return Wrench
}

// Channel chip icon mapping.
export function channelIcon(name: string): LucideIcon {
  const n = name.toLowerCase()
  if (n.includes('telegram')) return Send
  if (n.includes('web')) return Globe
  return Globe
}

export {
  CalendarClock,
  Globe,
  ShieldCheck,
  ScrollText,
  Brain as BrainIcon,
  Clock as ClockIcon,
} from 'lucide-react'
