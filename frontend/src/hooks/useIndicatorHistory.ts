import { useState, useCallback } from "react"

const DATA_URL = import.meta.env.BASE_URL + "data/indicator-history.json"

export interface MacroHistoryEntry {
  date: string
  price: number
  change_pct: number
}

export interface ExchangeHistoryEntry {
  date: string
  rate: number
  change: number | null
  change_rate: number | null
}

export interface IndicatorHistoryData {
  updated_at: string
  macro: Record<string, MacroHistoryEntry[]>
  exchange: Record<string, ExchangeHistoryEntry[]>
}

interface UseIndicatorHistoryReturn {
  data: IndicatorHistoryData | null
  loading: boolean
  fetchHistory: () => Promise<void>
}

export function useIndicatorHistory(): UseIndicatorHistoryReturn {
  const [data, setData] = useState<IndicatorHistoryData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (data) return // 이미 로드됨
    setLoading(true)
    try {
      const response = await fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" })
      if (!response.ok) return
      const json = await response.json()
      setData(json)
    } catch {
      // 파일이 없으면 무시
    } finally {
      setLoading(false)
    }
  }, [data])

  return { data, loading, fetchHistory }
}
