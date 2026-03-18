import { useState, useEffect, useCallback } from "react"
import type { InvestorIntraday } from "@/types/stock"
import { useAutoPolling } from "./useAutoPolling"

const DATA_URL = import.meta.env.BASE_URL + "data/investor-intraday.json"

interface UseInvestorIntradayReturn {
  data: InvestorIntraday | null
  refetch: () => Promise<void>
}

export function useInvestorIntraday(): UseInvestorIntradayReturn {
  const [data, setData] = useState<InvestorIntraday | null>(null)

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
