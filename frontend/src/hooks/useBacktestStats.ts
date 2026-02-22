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
        .select("status, confidence, category")
        .in("status", ["hit", "missed"])

      if (error || !data) {
        setStats(prev => ({ ...prev, loading: false }))
        return
      }

      let totalHit = 0
      const byConf: Record<string, { total: number; hit: number }> = {}
      const byCat: Record<string, { total: number; hit: number }> = {}

      for (const row of data) {
        const isHit = row.status === "hit"
        if (isHit) totalHit++

        for (const [map, key] of [[byConf, row.confidence], [byCat, row.category]] as const) {
          const k = (key as string) || "N/A"
          if (!map[k]) map[k] = { total: 0, hit: 0 }
          map[k].total++
          if (isHit) map[k].hit++
        }
      }

      const toGroups = (m: Record<string, { total: number; hit: number }>) =>
        Object.fromEntries(Object.entries(m).map(([k, v]) => [k, makeGroup(v.total, v.hit)]))

      setStats({
        overall: makeGroup(data.length, totalHit),
        byConfidence: toGroups(byConf),
        byCategory: toGroups(byCat),
        loading: false,
      })
    }

    fetch()
  }, [])

  return stats
}
