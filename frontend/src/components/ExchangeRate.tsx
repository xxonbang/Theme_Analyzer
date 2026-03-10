import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronUp, ArrowLeftRight, History, X } from "lucide-react"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import type { ExchangeData } from "@/types/stock"
import type { IndicatorHistoryData, ExchangeHistoryEntry } from "@/hooks/useIndicatorHistory"

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

function ExchangeChart({ entries, label }: { entries: ExchangeHistoryEntry[]; label: string }) {
  if (entries.length < 2) return <p className="text-[10px] text-muted-foreground/50 text-center py-4">데이터 부족</p>

  const W = 260, H = 100, PX = 32, PY = 12
  const chartW = W - PX * 2, chartH = H - PY * 2
  const rates = entries.map(e => e.rate)
  const min = Math.min(...rates), max = Math.max(...rates)
  const range = max - min || 1

  const points = entries.map((e, i) => ({
    x: PX + (i / (entries.length - 1)) * chartW,
    y: PY + (1 - (e.rate - min) / range) * chartH,
    rate: e.rate,
    date: e.date,
  }))
  const polyline = points.map(p => `${p.x},${p.y}`).join(" ")

  // 시작 대비 상승/하락
  const first = rates[0], last = rates[rates.length - 1]
  const isUp = last > first
  const color = isUp ? "#ef4444" : last < first ? "#3b82f6" : "#9ca3af"

  // Y축 라벨 3개
  const yLabels = [max, (max + min) / 2, min]

  return (
    <div className="mt-1.5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 120 }}>
        {/* Y축 그리드 + 라벨 */}
        {yLabels.map((v, i) => {
          const y = PY + (1 - (v - min) / range) * chartH
          return (
            <g key={i}>
              <line x1={PX} y1={y} x2={W - PX} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeDasharray="2,2" />
              <text x={PX - 3} y={y + 3} textAnchor="end" className="fill-muted-foreground/40" fontSize={7}>{v.toLocaleString()}</text>
            </g>
          )
        })}
        {/* 꺾은선 */}
        <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        {/* 데이터 포인트 */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={entries.length > 15 ? 1.5 : 2} fill={color} />
        ))}
        {/* X축 라벨: 첫/중간/끝 */}
        {[0, Math.floor(entries.length / 2), entries.length - 1].map((idx) => (
          <text key={idx} x={points[idx].x} y={H - 1} textAnchor="middle" className="fill-muted-foreground/40" fontSize={7}>
            {entries[idx].date.slice(5).replace("-", "/")}
          </text>
        ))}
      </svg>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground/50 px-1 mt-0.5">
        <span>{label} {first.toLocaleString()}원</span>
        <span style={{ color }}>{isUp ? "▲" : last < first ? "▼" : ""}{Math.abs(last - first).toFixed(1)}원 ({((last - first) / first * 100).toFixed(2)}%)</span>
        <span>{last.toLocaleString()}원</span>
      </div>
    </div>
  )
}

export function ExchangeRate({ exchange, history, historyLoading, onRequestHistory }: ExchangeRateProps) {
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [chartCurrency, setChartCurrency] = useState("USD")
  const { handleRef, sheetRef } = useSwipeToDismiss(() => setShowHistory(false))

  // 스크롤 잠금
  useEffect(() => {
    if (!showHistory) return
    const scrollY = window.scrollY
    document.body.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = "0"
    document.body.style.right = "0"
    return () => {
      document.body.style.overflow = ""
      document.body.style.position = ""
      document.body.style.top = ""
      document.body.style.left = ""
      document.body.style.right = ""
      window.scrollTo(0, scrollY)
    }
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
            <span className="text-[10px] text-muted-foreground/60 tabular-nums ml-1.5">{exchange.timestamp.slice(5, 10).replace("-", "/")} · {exchange.timestamp.slice(11, 16)}</span>
          )}
          {/* History 아이콘 */}
          <span
            role="button"
            onClick={handleHistoryClick}
            className="inline-flex items-center text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors ml-1.5"
          >
            <History className="w-3 h-3" />
          </span>
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

      {/* 히스토리 Bottom Sheet */}
      {showHistory && createPortal(
        <div className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/25" onClick={() => setShowHistory(false)} />
          <div ref={sheetRef} className="relative w-full sm:w-96 sm:max-w-[90vw] max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
            <div ref={handleRef} className="sm:hidden flex justify-center mb-2 py-3 cursor-grab">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">환율 히스토리</span>
              <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground p-1 -m-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            {historyLoading ? (
              <p className="text-[10px] text-muted-foreground/50 text-center py-2">로딩 중...</p>
            ) : dates.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/50 text-center py-2">히스토리 없음</p>
            ) : (
              <>
                {/* 통화 선택 탭 + 꺾은선 그래프 */}
                <div className="mb-2">
                  <div className="flex gap-1 mb-1">
                    {currencies.map((cur) => {
                      const info = currencyInfo[cur] || { flag: "💵", label: cur }
                      return (
                        <button
                          key={cur}
                          onClick={() => setChartCurrency(cur)}
                          className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${chartCurrency === cur ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground/50 hover:text-muted-foreground/80"}`}
                        >
                          {info.label}
                        </button>
                      )
                    })}
                  </div>
                  <ExchangeChart
                    entries={history?.exchange?.[chartCurrency] || []}
                    label={currencyInfo[chartCurrency]?.label || chartCurrency}
                  />
                </div>

                <hr className="border-border/20 my-1.5" />

                {/* 테이블 */}
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
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
