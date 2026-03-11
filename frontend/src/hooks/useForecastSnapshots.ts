import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { ThemeForecast } from "@/types/stock"

export interface SnapshotSummary {
  id: number
  generated_at: string
  mode: string
}

export interface ForecastSnapshot extends SnapshotSummary {
  forecast_data: ThemeForecast
}

interface UseForecastSnapshotsReturn {
  snapshots: SnapshotSummary[]
  selected: ForecastSnapshot | null
  loading: boolean
  select: (id: number) => void
}

export function useForecastSnapshots(predictionDate: string | null): UseForecastSnapshotsReturn {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([])
  const [selected, setSelected] = useState<ForecastSnapshot | null>(null)
  const [loading, setLoading] = useState(false)

  // 목록 조회 (forecast_data 제외, 가볍게) + 최신 스냅샷 자동 선택
  useEffect(() => {
    if (!predictionDate) return
    let cancelled = false

    const fetchList = async () => {
      const { data, error } = await supabase
        .from("forecast_snapshots")
        .select("id, generated_at, mode")
        .eq("prediction_date", predictionDate)
        .order("generated_at", { ascending: true })

      if (!error && data && !cancelled) {
        setSnapshots(data)
        // 스냅샷이 있고 아직 선택된 것이 없으면 최신(마지막) 자동 선택
        if (data.length > 0 && !selected) {
          const latest = data[data.length - 1]
          select(latest.id)
        }
      }
    }

    fetchList()
    return () => { cancelled = true }
  }, [predictionDate])

  // 특정 스냅샷 선택 시 full fetch
  const select = useCallback(async (id: number) => {
    // 이미 선택된 스냅샷이면 무시
    if (selected?.id === id) return

    setLoading(true)
    const { data, error } = await supabase
      .from("forecast_snapshots")
      .select("id, generated_at, mode, forecast_data")
      .eq("id", id)
      .single()

    if (!error && data) {
      let forecastData = data.forecast_data
      if (typeof forecastData === "string") {
        try { forecastData = JSON.parse(forecastData) } catch { forecastData = null }
      }
      if (forecastData) {
        setSelected({
          id: data.id,
          generated_at: data.generated_at,
          mode: data.mode,
          forecast_data: forecastData as ThemeForecast,
        })
      }
    }
    setLoading(false)
  }, [selected?.id])

  return { snapshots, selected, loading, select }
}
