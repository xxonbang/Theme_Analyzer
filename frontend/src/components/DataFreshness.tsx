import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import type { StockData, IntradayHistoryData, InvestorIntraday, ThemeForecast } from "@/types/stock"

interface DataFreshnessProps {
  stockData: StockData | null
  investorIntraday: InvestorIntraday | null
  intradayHistory: IntradayHistoryData | null
  themeForecast: ThemeForecast | null
}

interface SourceInfo {
  label: string
  time: string | null
}

function parseTimeToDate(timeStr: string): Date | null {
  if (!timeStr) return null
  // ISO format: "2026-03-18T09:45:00+09:00" or "2026-03-18 09:45"
  const d = new Date(timeStr)
  if (!isNaN(d.getTime())) return d
  return null
}

function formatHHMM(timeStr: string): string | null {
  const d = parseTimeToDate(timeStr)
  if (!d) return null
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

function getAgeColor(timeStr: string): string {
  const d = parseTimeToDate(timeStr)
  if (!d) return ""
  const ageMs = Date.now() - d.getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  if (ageHours >= 6) return "bg-red-500/15 text-red-600 border-red-500/20"
  if (ageHours >= 2) return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20"
  return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
}

export function DataFreshness({ stockData, investorIntraday, intradayHistory, themeForecast }: DataFreshnessProps) {
  const sources = useMemo<SourceInfo[]>(() => {
    const items: SourceInfo[] = []

    items.push({
      label: "시세",
      time: stockData?.timestamp ?? null,
    })

    // 수급: intraday 마지막 스냅샷 vs latest.json 확정 데이터 중 최신
    const snapshots = investorIntraday?.snapshots
    const lastSnapshot = snapshots?.[snapshots.length - 1]
    const intradayTime = lastSnapshot && investorIntraday?.date
      ? `${investorIntraday.date}T${lastSnapshot.time}:00+09:00`
      : null
    const confirmedTime = stockData?.investor_updated_at ?? null
    const intradayDate = intradayTime ? parseTimeToDate(intradayTime) : null
    const confirmedDate = confirmedTime ? parseTimeToDate(confirmedTime) : null
    const investorTime = intradayDate && confirmedDate
      ? (confirmedDate > intradayDate ? confirmedTime : intradayTime)
      : confirmedTime ?? intradayTime
    items.push({
      label: "수급",
      time: investorTime,
    })

    items.push({
      label: "장중",
      time: intradayHistory?.updated_at ?? null,
    })

    items.push({
      label: "AI예측",
      time: themeForecast?.generated_at ?? null,
    })

    return items
  }, [stockData, investorIntraday, intradayHistory, themeForecast])

  const hasAny = sources.some(s => s.time)
  if (!hasAny) return null

  const visibleSources = sources.filter(s => s.time && formatHHMM(s.time))

  return (
    <div className="flex items-center gap-1 flex-wrap px-1">
      <span className="text-[10px] text-muted-foreground/70 shrink-0">갱신:</span>
      {visibleSources.map((s, i) => (
        <span key={s.label} className="flex items-center gap-1">
          <Badge
            className={`text-[10px] px-1.5 py-0 font-normal ${getAgeColor(s.time!)}`}
          >
            {s.label} {formatHHMM(s.time!)}
          </Badge>
          {i < visibleSources.length - 1 && (
            <span className="text-border text-[10px]" aria-hidden>·</span>
          )}
        </span>
      ))}
    </div>
  )
}
