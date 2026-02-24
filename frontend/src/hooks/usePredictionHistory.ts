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

export interface PredictionHistoryState {
  dates: PredictionsByDate[]
  loading: boolean
}

export function usePredictionHistory(): PredictionHistoryState {
  const [state, setState] = useState<PredictionHistoryState>({
    dates: [],
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
        setState({ dates: [], loading: false })
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

      setState({ dates, loading: false })
    }

    fetchHistory()
  }, [])

  return state
}
