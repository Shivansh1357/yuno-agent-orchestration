import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useMeta } from './MetaContext'
import MonitorPage from './pages/MonitorPage'
import AgentsPage from './pages/AgentsPage'
import WorkflowsPage from './pages/WorkflowsPage'
import ChatPage from './pages/ChatPage'
import {
  Activity,
  AlertTriangle,
  Bot,
  Hexagon,
  MessagesSquare,
  WorkflowIcon,
  STROKE,
} from './icons'
import { pageVariants } from './motion'
import type { LucideIcon } from 'lucide-react'

function StatusPill({ label, on }: { label: string; on: boolean }) {
  return (
    <div className={`pill ${on ? 'pill-on' : 'pill-off'}`} title={on ? 'connected' : 'not configured'}>
      <span className="pill-dot" />
      {label}
      <span className="pill-state">{on ? 'connected' : 'not configured'}</span>
    </div>
  )
}

const navItems: { to: string; label: string; Icon: LucideIcon; end: boolean }[] = [
  { to: '/', label: 'Monitor', Icon: Activity, end: true },
  { to: '/agents', label: 'Agents', Icon: Bot, end: false },
  { to: '/workflows', label: 'Workflows', Icon: WorkflowIcon, end: false },
  { to: '/chat', label: 'Chat', Icon: MessagesSquare, end: false },
]

export default function App() {
  const { meta } = useMeta()
  const llmOff = meta != null && !meta.llm_enabled
  const location = useLocation()
  // Route key for AnimatePresence — only the top-level section matters.
  const routeKey = '/' + (location.pathname.split('/')[1] ?? '')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Hexagon size={20} strokeWidth={STROKE} />
          </div>
          <div className="brand-text">
            <strong>Yuno</strong>
            <span>Mission Control</span>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-section-label">Orchestration</div>
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {({ isActive }) => (
                <motion.span
                  className="nav-item-inner"
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                >
                  <span className="nav-icon">
                    <Icon size={18} strokeWidth={isActive ? 2 : STROKE} />
                  </span>
                  {label}
                </motion.span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <StatusPill label="LLM" on={!!meta?.llm_enabled} />
          <StatusPill label="Telegram" on={!!meta?.telegram_enabled} />
          {meta && (
            <div className="model-hint muted">
              {meta.models.length} models · default {meta.default_model}
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        {llmOff && (
          <div className="banner banner-warn">
            <AlertTriangle size={15} strokeWidth={STROKE} /> Set <code>ANTHROPIC_API_KEY</code> in{' '}
            <code>backend/.env</code> to run agents.
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={routeKey}
            className="route-view"
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
          >
            <Routes location={location}>
              <Route path="/" element={<MonitorPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/workflows" element={<WorkflowsPage />} />
              <Route path="/workflows/:id" element={<WorkflowsPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
