import { useState, useEffect, useCallback } from "react"

const DATA_URL = import.meta.env.BASE_URL + "data/stock-history.json"

export function useStockHistory() {
  const [history, setHistory] = useState<Record<string, any> | null>(null)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(DATA_URL + "?t=" + Date.now())
      if (!res.ok) return
      const data = await res.json()
      setHistory(data)
    } catch {
      // stock-history.json이 없으면 무시 (이전 버전 호환)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return { history, refetchHistory: fetchHistory }
}
