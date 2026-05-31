import { useCallback, useEffect, useRef, useState } from 'react'
import { wsUrl } from './api'
import type { Message, MonitorEvent, RunStatus } from './types'

export type ConnState = 'connecting' | 'open' | 'closed'

export interface MonitorTotals {
  inputTokens: number
  outputTokens: number
  costUsd: number
}

interface UseMonitorResult {
  messages: Message[]
  totals: MonitorTotals
  conn: ConnState
  runStatuses: Record<string, RunStatus>
  clear: () => void
}

const MAX_BUFFER = 500

export function useMonitor(): UseMonitorResult {
  const [messages, setMessages] = useState<Message[]>([])
  const [totals, setTotals] = useState<MonitorTotals>({
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  })
  const [conn, setConn] = useState<ConnState>('connecting')
  const [runStatuses, setRunStatuses] = useState<Record<string, RunStatus>>({})

  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aliveRef = useRef(true)

  const clear = useCallback(() => {
    setMessages([])
    setTotals({ inputTokens: 0, outputTokens: 0, costUsd: 0 })
    setRunStatuses({})
  }, [])

  useEffect(() => {
    aliveRef.current = true

    const connect = () => {
      if (!aliveRef.current) return
      setConn('connecting')
      let ws: WebSocket
      try {
        ws = new WebSocket(wsUrl('/ws/monitor'))
      } catch {
        scheduleReconnect()
        return
      }
      wsRef.current = ws

      ws.onopen = () => {
        retryRef.current = 0
        setConn('open')
      }

      ws.onmessage = (ev) => {
        let data: MonitorEvent
        try {
          data = JSON.parse(ev.data)
        } catch {
          return
        }
        if (data.kind === 'message') {
          const msg = data as Message
          setMessages((prev) => {
            const next = [...prev, msg]
            return next.length > MAX_BUFFER ? next.slice(next.length - MAX_BUFFER) : next
          })
          setTotals((prev) => ({
            inputTokens: prev.inputTokens + (msg.input_tokens || 0),
            outputTokens: prev.outputTokens + (msg.output_tokens || 0),
            costUsd: prev.costUsd + (msg.cost_usd || 0),
          }))
        } else if (data.kind === 'run_status') {
          setRunStatuses((prev) => ({ ...prev, [data.run_id]: data.status }))
        }
      }

      ws.onclose = () => {
        setConn('closed')
        scheduleReconnect()
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    const scheduleReconnect = () => {
      if (!aliveRef.current) return
      const delay = Math.min(1000 * 2 ** retryRef.current, 10000)
      retryRef.current += 1
      timerRef.current = setTimeout(connect, delay)
    }

    connect()

    return () => {
      aliveRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [])

  return { messages, totals, conn, runStatuses, clear }
}
