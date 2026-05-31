import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { RunStatus } from '../types'
import { AlertTriangle, STATUS_ICON, STROKE, X } from '../icons'
import { modalVariants, overlayVariants } from '../motion'

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {label && <span className="muted">{label}</span>}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string
  hint?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {hint && <div className="muted">{hint}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box">
      <span className="error-box-msg">
        <AlertTriangle size={15} strokeWidth={STROKE} /> {message}
      </span>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function StatusBadge({ status }: { status: RunStatus }) {
  const Icon = STATUS_ICON[status]
  return (
    <span className={`status-badge status-${status}`}>
      <Icon
        size={12}
        strokeWidth={2}
        className={status === 'running' ? 'spin-icon status-badge-icon' : 'status-badge-icon'}
      />
      {status}
    </span>
  )
}

export function Chip({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`chip ${tone ? `chip-${tone}` : ''}`}>{children}</span>
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        onClick={onClose}
        variants={overlayVariants}
        initial="initial"
        animate="enter"
        exit="exit"
      >
        <motion.div
          className={`modal ${wide ? 'modal-wide' : ''}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          variants={modalVariants}
          initial="initial"
          animate="enter"
          exit="exit"
        >
          <div className="modal-header">
            <div>
              <h2>{title}</h2>
              {subtitle && <p className="muted">{subtitle}</p>}
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={16} strokeWidth={STROKE} />
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {label && <span>{label}</span>}
    </label>
  )
}
