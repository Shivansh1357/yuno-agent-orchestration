import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useMeta } from './MetaContext'
import MonitorPage from './pages/MonitorPage'
import AgentsPage from './pages/AgentsPage'
import WorkflowsPage from './pages/WorkflowsPage'
import ChatPage from './pages/ChatPage'

function StatusPill({ label, on }: { label: string; on: boolean }) {
  return (
    <div className={`pill ${on ? 'pill-on' : 'pill-off'}`} title={on ? 'connected' : 'not configured'}>
      <span className="pill-dot" />
      {label}
      <span className="pill-state">{on ? 'connected' : 'not configured'}</span>
    </div>
  )
}

const navItems = [
  { to: '/', label: 'Monitor', icon: '📡', end: true },
  { to: '/agents', label: 'Agents', icon: '🤖', end: false },
  { to: '/workflows', label: 'Workflows', icon: '🕸', end: false },
  { to: '/chat', label: 'Chat', icon: '💬', end: false },
]

export default function App() {
  const { meta } = useMeta()
  const llmOff = meta != null && !meta.llm_enabled

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Y</div>
          <div className="brand-text">
            <strong>Yuno</strong>
            <span>Mission Control</span>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-section-label">Orchestration</div>
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{it.icon}</span>
              {it.label}
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
            ⚠ Set <code>ANTHROPIC_API_KEY</code> in <code>backend/.env</code> to run agents.
          </div>
        )}
        <Routes>
          <Route path="/" element={<MonitorPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/workflows/:id" element={<WorkflowsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
