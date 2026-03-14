import { useState, useEffect, useCallback } from "react"
import type { ExchangeData } from "@/types/stock"

const DATA_URL = import.meta.env.BASE_URL + "data/macro-indicators.json"

export interface MacroIndicator {
  symbol: string
  name: string
  price: number
  change: number
  change_pct: number
  source: string
}

export interface MarketInvestorEntry {
  index: number
  change_pct: number
  foreign: number
  individual: number
  institution: number
}

export interface InvestorTrendDay {
  date: string
  kospi: MarketInvestorEntry
  kosdaq: MarketInvestorEntry
}

export interface MacroIndicatorsData {
  updated_at: string
  indicators: MacroIndicator[]
  exchange?: ExchangeData
  investor_trend?: InvestorTrendDay[]
}

interface UseMacroIndicatorsReturn {
  data: MacroIndicatorsData | null
  refetch: () => Promise<void>
}

export function useMacroIndicators(): UseMacroIndicatorsReturn {
  const [data, setData] = useState<MacroIndicatorsData | null>(null)

  const refetch = useCallback(async () => {
    try {
      const response = await fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" })
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

  return { data, refetch }
}
