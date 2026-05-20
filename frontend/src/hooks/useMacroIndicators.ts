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
  collected_at?: string  // cron이 데이터를 fetch한 시각
  price_at?: string       // 가격이 실제로 측정된 시각 (시장 마감 시각). 진행 중 상품은 없음
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

export interface FuturesItem {
  symbol: string
  name: string
  price: number
  change: number
  change_pct: number
  status: string
  source: string
  collected_at?: string  // cron이 데이터를 fetch한 시각
  price_at?: string       // 가격이 실제로 측정된 시각 (시장 마감 시각). 진행 중 상품은 없음
}

export interface MacroIndicatorsData {
  updated_at: string
  indicators: MacroIndicator[]
  exchange?: ExchangeData
  investor_trend?: InvestorTrendDay[]
  futures?: FuturesItem[]
}

interface UseMacroIndicatorsReturn {
  data: MacroIndicatorsData | null
  refetch: () => Promise<void>
}

export function useMacroIndicators(): UseMacroIndicatorsReturn {
  const [data, setData] = useState<MacroIndicatorsData | null>(null)

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

  return { data, refetch }
}
