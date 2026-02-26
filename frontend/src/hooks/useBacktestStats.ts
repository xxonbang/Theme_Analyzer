import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface AccuracyGroup { total: number; hit: number; accuracy: number }

export interface StockDetail {
  date: string
  stockName: string
  stockCode: string
  themeName: string
  returnPct: number
  isHit: boolean
}

export interface BacktestStats {
  overall: AccuracyGroup
  byConfidence: Record<string, AccuracyGroup>
  byCategory: Record<string, AccuracyGroup>
  detailsByConfidence: Record<string, StockDetail[]>
  dateRange: { from: string; to: string } | null
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
    detailsByConfidence: {},
    dateRange: null,
    loading: true,
  })

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("theme_predictions")
        .select("prediction_date, status, confidence, category, leader_stocks, actual_performance, theme_name")
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
      const detailsByConf: Record<string, StockDetail[]> = {}

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

        const themeName = (row as Record<string, unknown>).theme_name as string || ""

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

          if (!detailsByConf[conf]) detailsByConf[conf] = []
          detailsByConf[conf].push({
            date: row.prediction_date as string,
            stockName: s.name,
            stockCode: s.code,
            themeName,
            returnPct: ret,
            isHit,
          })
        }
      }

      // 날짜 내림차순 정렬
      for (const arr of Object.values(detailsByConf)) {
        arr.sort((a, b) => b.date.localeCompare(a.date))
      }

      const toGroups = (m: Record<string, { total: number; hit: number }>) =>
        Object.fromEntries(Object.entries(m).map(([k, v]) => [k, makeGroup(v.total, v.hit)]))

      const dates = data.map(r => r.prediction_date as string).filter(Boolean).sort()
      const dateRange = dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null

      setStats({
        overall: makeGroup(totalCount, totalHit),
        byConfidence: toGroups(byConf),
        byCategory: toGroups(byCat),
        detailsByConfidence: detailsByConf,
        dateRange,
        loading: false,
      })
    }

    fetch()
  }, [])

  return stats
}
