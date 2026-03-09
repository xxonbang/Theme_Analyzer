import { useState, useRef, useEffect } from "react"
import { ChevronDown, ChevronUp, ArrowLeftRight, History } from "lucide-react"
import type { ExchangeData } from "@/types/stock"
import type { IndicatorHistoryData } from "@/hooks/useIndicatorHistory"

interface ExchangeRateProps {
  exchange: ExchangeData
  history?: IndicatorHistoryData | null
  historyLoading?: boolean
  onRequestHistory?: () => void
}

const currencyInfo: Record<string, { flag: string; label: string }> = {
  USD: { flag: "🇺🇸", label: "USD" },
  JPY: { flag: "🇯🇵", label: "JPY(100)" },
  EUR: { flag: "🇪🇺", label: "EUR" },
  CNY: { flag: "🇨🇳", label: "CNY" },
}

export function ExchangeRate({ exchange, history, historyLoading, onRequestHistory }: ExchangeRateProps) {
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const historyRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!showHistory) return
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showHistory])

  if (!exchange?.rates?.length) {
    return null
  }

  const usd = exchange.rates.find((r) => r.currency === "USD")

  const handleHistoryClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!showHistory && onRequestHistory) onRequestHistory()
    setShowHistory(!showHistory)
  }

  // 히스토리 테이블 데이터: 최근 10일
  const currencies = exchange.rates.map(r => r.currency)
  const historyRows = history?.exchange
    ? currencies.map((cur) => {
        const info = currencyInfo[cur] || { flag: "💵", label: cur }
        const entries = (history.exchange[cur] || []).slice(-10)
        return { currency: cur, label: info.label, entries }
      })
    : []

  const dates = historyRows.length > 0
    ? historyRows.reduce((longest, row) => row.entries.length > longest.length ? row.entries : longest, [] as { date: string }[]).map(e => e.date)
    : []

  return (
    <div className="mb-3 sm:mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full cursor-pointer group text-left"
      >
        {/* 헤더 */}
        <div className="flex items-center px-1 py-1">
          <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <span className="text-xs font-semibold text-foreground/80 ml-1.5">환율</span>
          {exchange.timestamp && (
            <span className="text-[10px] text-muted-foreground/35 tabular-nums ml-1.5">{exchange.timestamp.slice(5, 10).replace("-", "/")} · {exchange.timestamp.slice(11, 16)}</span>
          )}
          {/* History 아이콘 */}
          <div className="relative ml-1.5" ref={historyRef}>
            <span
              role="button"
              onClick={handleHistoryClick}
              className="inline-flex items-center text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
            >
              <History className="w-3 h-3" />
            </span>
            {/* 드롭다운 */}
            {showHistory && (
              <div
                className="absolute left-0 top-5 z-50 bg-card border border-border rounded-lg shadow-lg p-2 min-w-[280px] max-h-[320px] overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {historyLoading ? (
                  <p className="text-[10px] text-muted-foreground/50 text-center py-2">로딩 중...</p>
                ) : dates.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/50 text-center py-2">히스토리 없음</p>
                ) : (
                  <table className="w-full text-[10px] tabular-nums">
                    <thead>
                      <tr className="text-muted-foreground/50">
                        <th className="text-left py-0.5 pr-2 font-medium">날짜</th>
                        {historyRows.map((row) => (
                          <th key={row.currency} className="text-right py-0.5 px-1 font-medium">{row.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...dates].reverse().map((date) => (
                        <tr key={date} className="border-t border-border/20">
                          <td className="py-0.5 pr-2 text-muted-foreground/60">{date.slice(5).replace("-", "/")}</td>
                          {historyRows.map((row) => {
                            const entry = row.entries.find(e => e.date === date)
                            if (!entry) return <td key={row.currency} className="text-right py-0.5 px-1 text-muted-foreground/30">—</td>
                            const change = entry.change
                            const isUp = change != null && change > 0
                            const isDown = change != null && change < 0
                            return (
                              <td
                                key={row.currency}
                                className={`text-right py-0.5 px-1 font-medium ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}
                              >
                                <span className="text-muted-foreground/50">{entry.rate.toLocaleString()}</span>
                                {change != null && change !== 0 && (
                                  <span className="ml-0.5">
                                    {isUp ? "▲" : "▼"}{Math.abs(change).toFixed(1)}
                                  </span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
          <span className="ml-auto text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>

        {/* 접힌 상태: USD 한 줄 바 */}
        {!expanded && usd && (() => {
          const change = usd.change
          const isUp = change != null && change > 0
          const isDown = change != null && change < 0
          return (
            <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-md mt-1 ${isUp ? "bg-red-500/[0.04]" : isDown ? "bg-blue-500/[0.04]" : "bg-card/80"} border border-border/20`}>
              <span className="text-[10px] text-muted-foreground/55 font-medium">🇺🇸 USD</span>
              <span className="flex items-center gap-2">
                <span className="text-[12px] tabular-nums font-semibold text-foreground/90">
                  {usd.rate.toLocaleString()}<span className="text-muted-foreground/40 text-[10px] font-normal ml-0.5">원</span>
                </span>
                {change != null && change !== 0 && (
                  <span className={`text-[10px] tabular-nums font-medium ${isUp ? "text-red-500" : "text-blue-500"}`}>
                    {isUp ? "▲" : "▼"}{Math.abs(change).toLocaleString()}
                  </span>
                )}
              </span>
            </div>
          )
        })()}
      </button>

      {/* 펼친 상태 */}
      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5 px-1">
          {exchange.rates.map((rate) => {
            const info = currencyInfo[rate.currency] || { flag: "💵", label: rate.currency }
            const change = rate.change
            const isUp = change != null && change > 0
            const isDown = change != null && change < 0
            const accent = isUp ? "border-l-red-500/60" : isDown ? "border-l-blue-500/60" : "border-l-border"

            return (
              <div
                key={rate.currency}
                className={`rounded-md border border-border/50 border-l-2 ${accent} bg-card/60 backdrop-blur-sm px-2.5 py-2 flex flex-col gap-1 transition-colors hover:bg-card`}
              >
                <span className="text-[10px] text-muted-foreground/60 font-medium leading-none">
                  {info.flag} {info.label}
                </span>
                <span className="text-[13px] font-bold tabular-nums tracking-tight leading-none text-foreground">
                  {rate.rate.toLocaleString()}<span className="text-muted-foreground/40 text-[10px] font-normal ml-0.5">원</span>
                </span>
                <span className={`text-[10px] font-medium tabular-nums leading-none ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}>
                  {change != null && change !== 0
                    ? `${isUp ? "▲" : "▼"} ${Math.abs(change).toLocaleString()}${rate.change_rate ? ` (${rate.change_rate > 0 ? "+" : ""}${rate.change_rate.toFixed(2)}%)` : ""}`
                    : "— 0"}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
