import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import type { Meta } from './types'

interface MetaState {
  meta: Meta | null
  loading: boolean
  error: string | null
  reload: () => void
}

const MetaCtx = createContext<MetaState>({
  meta: null,
  loading: true,
  error: null,
  reload: () => {},
})

export function MetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api
      .getMeta()
      .then((m) => {
        setMeta(m)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  return (
    <MetaCtx.Provider value={{ meta, loading, error, reload: load }}>{children}</MetaCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMeta() {
  return useContext(MetaCtx)
}
