import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface AccuracyGroup { total: number; hit: number; accuracy: number }

export interface BacktestStats {
  overall: AccuracyGroup
  byConfidence: Record<string, AccuracyGroup>
  byCategory: Record<string, AccuracyGroup>
  loading: boolean
}

function makeGroup(total: number, hit: number): AccuracyGroup {
  return { total, hit, accuracy: total > 0 ? Math.round((hit / total) * 1000) / 10 : 0 }
}

export function useBacktestStats(): BacktestStats {
  const [stats, setStats] = useState<BacktestStats>({
    overall: { total: 0, hit: 0, accuracy: 0 },
    byConfidence: {},
    byCategory: {},
    loading: true,
  })

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("theme_predictions")
        .select("prediction_date, status, confidence, category, leader_stocks, actual_performance")
        .in("status", ["hit", "missed"])

      if (error || !data) {
        setStats(prev => ({ ...prev, loading: false }))
        return
      }

      // 종목 기준 집계: 날짜+종목코드로 중복 제거
      const seen = new Set<string>()
      let totalCount = 0
      let totalHit = 0
      const byConf: Record<string, { total: number; hit: number }> = {}
      const byCat: Record<string, { total: number; hit: number }> = {}

      for (const row of data) {
        let stocks = row.leader_stocks
        if (typeof stocks === "string") {
          try { stocks = JSON.parse(stocks) } catch { stocks = [] }
        }
        if (!Array.isArray(stocks)) stocks = []

        let perf = row.actual_performance
        if (typeof perf === "string") {
          try { perf = JSON.parse(perf) } catch { perf = null }
        }

        for (const s of stocks as { code: string; name: string }[]) {
          const key = `${row.prediction_date}:${s.code}`
          if (seen.has(key)) continue
          seen.add(key)

          const ret = perf?.[s.code] ?? null
          if (ret == null) continue

          const isHit = ret >= 2.0

          totalCount++
          if (isHit) totalHit++

          const conf = row.confidence || "N/A"
          const cat = row.category || "N/A"

          if (!byConf[conf]) byConf[conf] = { total: 0, hit: 0 }
          byConf[conf].total++
          if (isHit) byConf[conf].hit++

          if (!byCat[cat]) byCat[cat] = { total: 0, hit: 0 }
          byCat[cat].total++
          if (isHit) byCat[cat].hit++
        }
      }

      const toGroups = (m: Record<string, { total: number; hit: number }>) =>
        Object.fromEntries(Object.entries(m).map(([k, v]) => [k, makeGroup(v.total, v.hit)]))

      setStats({
        overall: makeGroup(totalCount, totalHit),
        byConfidence: toGroups(byConf),
        byCategory: toGroups(byCat),
        loading: false,
      })
    }

    fetch()
  }, [])

  return stats
}
