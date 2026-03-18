import { useState, useEffect, useCallback } from "react"
import type { IntradayHistoryData } from "@/types/stock"
import { useAutoPolling } from "./useAutoPolling"

const DATA_URL = import.meta.env.BASE_URL + "data/intraday-history.json"

interface UseIntradayHistoryReturn {
  data: IntradayHistoryData | null
  refetch: () => Promise<void>
}

export function useIntradayHistory(): UseIntradayHistoryReturn {
  const [data, setData] = useState<IntradayHistoryData | null>(null)

  const refetch = useCallback(async () => {
    try {
      const response = await fetch(DATA_URL + "?t=" + Date.now())
      if (!response.ok) return
      const json = await response.json()
      setData(json)
    } catch {
      // 파일이 없으면 무시
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  useAutoPolling(refetch)

  return { data, refetch }
}
