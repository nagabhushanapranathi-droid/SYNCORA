import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../services/api'

/**
 * Load data from the API with explicit loading / error states.
 * `loader` returns a promise; when it rejects, `error` holds a readable message and
 * `data` keeps its previous value (it is never replaced with invented values).
 */
export default function useLoad(loader, deps = [], { initial = null, enabled = true } = {}) {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const seq = useRef(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const reload = useCallback(async () => {
    const id = ++seq.current
    setLoading(true)
    setError('')
    try {
      const result = await loaderRef.current()
      if (id === seq.current) setData(result)
      return result
    } catch (err) {
      if (id === seq.current) setError(errorMessage(err, 'The server could not provide this information.'))
      return undefined
    } finally {
      if (id === seq.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (enabled) reload()
    else setLoading(false)
  }, [reload, enabled])

  return { data, setData, loading, error, reload }
}
