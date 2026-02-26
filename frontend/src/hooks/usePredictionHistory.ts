import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export interface PredictionRecord {
  id: number
  prediction_date: string
  category: string
  theme_name: string
  confidence: string
  status: string
  leader_stocks: { priority: number; name: string; code: string }[]
  actual_performance: Record<string, number> | null
  evaluated_at: string | null
}

export interface PredictionsByDate {
  date: string
  predictions: PredictionRecord[]
}

export interface ThemeInfo {
  theme_name: string
  status: string
  confidence: string
  category: string
  leader_stocks: { name: string; code: string }[]
  actual_performance: Record<string, number> | null
}

export interface StockPrediction {
  code: string
  name: string
  returnByCategory: Record<string, number | null>
  evaluatedByCategory: Record<string, boolean>
  themes: ThemeInfo[]
}

export interface StockPredictionsByDate {
  date: string
  stocks: StockPrediction[]
}

export interface PredictionHistoryState {
  dates: PredictionsByDate[]
  stockDates: StockPredictionsByDate[]
  loading: boolean
}

function toStockDates(dates: PredictionsByDate[]): StockPredictionsByDate[] {
  return dates.map(({ date, predictions }) => {
    const stockMap = new Map<string, StockPrediction>()

    for (const pred of predictions) {
      const perf = pred.actual_performance
      const evaluated = pred.status === "hit" || pred.status === "missed"

      for (const s of pred.leader_stocks) {
        const ret = perf?.[s.code] ?? null
        const themeInfo: ThemeInfo = { theme_name: pred.theme_name, status: pred.status, confidence: pred.confidence, category: pred.category, leader_stocks: pred.leader_stocks, actual_performance: perf }
        const existing = stockMap.get(s.code)

        if (existing) {
          existing.themes.push(themeInfo)
          if (existing.returnByCategory[pred.category] == null && ret != null) {
            existing.returnByCategory[pred.category] = ret
          }
          if (evaluated) existing.evaluatedByCategory[pred.category] = true
        } else {
          stockMap.set(s.code, {
            code: s.code, name: s.name,
            returnByCategory: { [pred.category]: ret },
            evaluatedByCategory: { [pred.category]: evaluated },
            themes: [themeInfo],
          })
        }
      }
    }

    return { date, stocks: Array.from(stockMap.values()) }
  })
}

export function usePredictionHistory(): PredictionHistoryState {
  const [state, setState] = useState<PredictionHistoryState>({
    dates: [],
    stockDates: [],
    loading: true,
  })

  useEffect(() => {
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from("theme_predictions")
        .select("id, prediction_date, category, theme_name, confidence, status, leader_stocks, actual_performance, evaluated_at")
        .in("status", ["hit", "missed", "expired", "active"])
        .order("prediction_date", { ascending: false })
        .order("category", { ascending: true })
        .limit(200)

      if (error || !data) {
        setState({ dates: [], stockDates: [], loading: false })
        return
      }

      // leader_stocks JSON 파싱 + 날짜별 그룹핑
      const byDate: Record<string, PredictionRecord[]> = {}
      for (const row of data) {
        let stocks = row.leader_stocks
        if (typeof stocks === "string") {
          try { stocks = JSON.parse(stocks) } catch { stocks = [] }
        }
        let perf = row.actual_performance
        if (typeof perf === "string") {
          try { perf = JSON.parse(perf) } catch { perf = null }
        }

        const record: PredictionRecord = {
          ...row,
          leader_stocks: Array.isArray(stocks) ? stocks : [],
          actual_performance: perf,
        }

        const d = row.prediction_date
        if (!byDate[d]) byDate[d] = []
        byDate[d].push(record)
      }

      const dates = Object.entries(byDate)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, predictions]) => ({ date, predictions }))

      setState({ dates, stockDates: toStockDates(dates), loading: false })
    }

    fetchHistory()
  }, [])

  return state
}
