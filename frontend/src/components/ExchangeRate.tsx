import { useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronUp, ArrowLeftRight, History, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { useScrollLock } from "@/hooks/useScrollLock"
import type { ExchangeData } from "@/types/stock"
import type { IndicatorHistoryData, ExchangeHistoryEntry } from "@/hooks/useIndicatorHistory"

const fmtRate = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const TODAY_KST = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()

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

  const W = 300, H = 110, PL = 38, PR = 20, PT = 12, PB = 22
  const chartW = W - PL - PR, chartH = H - PT - PB
  const rates = entries.map(e => e.rate)
  const min = Math.min(...rates), max = Math.max(...rates)
  const range = max - min || 1

  const points = entries.map((e, i) => ({
    x: PL + (i / (entries.length - 1)) * chartW,
    y: PT + (1 - (e.rate - min) / range) * chartH,
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
          const y = PT + (1 - (v - min) / range) * chartH
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeDasharray="2,2" />
              <text x={PL - 3} y={y + 3} textAnchor="end" fill="#666" fontWeight={600} fontSize={9}>{fmtRate(v)}</text>
            </g>
          )
        })}
        {/* 꺾은선 */}
        <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        {/* 데이터 포인트 */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 3.5 : (entries.length > 15 ? 1.5 : 2)} fill={color} />
        ))}
        {/* 마지막 포인트 강조 링 */}
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={6} fill={color} fillOpacity={0.15} />
        {/* X축 라벨: 첫/중간/끝 */}
        {[0, Math.floor(entries.length / 2), entries.length - 1].map((idx) => {
          const anchor = idx === 0 ? "start" : idx === entries.length - 1 ? "end" : "middle"
          return (
            <text key={idx} x={points[idx].x} y={PT + chartH + 12} textAnchor={anchor} fill="#555" fontWeight={600} fontSize={9}>
              {entries[idx].date.slice(5).replace("-", "/")}
            </text>
          )
        })}
      </svg>
      <div className="flex items-center justify-between text-[10px] text-foreground/70 px-1 mt-0.5">
        <span>{label} {fmtRate(first)}원</span>
        <span style={{ color }}>{isUp ? "▲" : last < first ? "▼" : ""}{Math.abs(last - first).toFixed(1)}원 ({((last - first) / first * 100).toFixed(2)}%)</span>
        <span>{fmtRate(last)}원</span>
      </div>
    </div>
  )
}

export function ExchangeRate({ exchange, history, historyLoading, onRequestHistory }: ExchangeRateProps) {
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [chartCurrency, setChartCurrency] = useState("USD")
  const { handleRef, sheetRef } = useSwipeToDismiss(() => setShowHistory(false), 80, showHistory)
  useScrollLock(showHistory)

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
    ? historyRows.reduce((longest, row) => row.entries.length > longest.length ? row.entries : longest, [] as { date: string }[]).map(e => e.date).slice().reverse()
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
          {/* History 버튼 */}
          <span
            role="button"
            onClick={handleHistoryClick}
            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground/60 hover:text-primary bg-muted/60 hover:bg-primary/10 rounded px-1.5 py-0.5 transition-colors ml-1.5"
          >
            <History className="w-3 h-3" />
            히스토리
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
                  {fmtRate(usd.rate)}<span className="text-muted-foreground/40 text-[10px] font-normal ml-0.5">원</span>
                </span>
                {change != null && change !== 0 && (
                  <span className={`text-[10px] tabular-nums font-medium ${isUp ? "text-red-500" : "text-blue-500"}`}>
                    {isUp ? "▲" : "▼"}{fmtRate(Math.abs(change))}
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

            const isUSD = rate.currency === "USD"
            return (
              <div
                key={rate.currency}
                className={cn(
                  "rounded-md border border-border/50 border-l-2 bg-card/60 backdrop-blur-sm px-2.5 py-2 flex flex-col gap-1 transition-colors hover:bg-card",
                  accent,
                  isUSD && "shadow-sm"
                )}
              >
                <span className="text-[10px] text-muted-foreground/60 font-medium leading-none">
                  {info.flag} {info.label}
                </span>
                <span className="text-[13px] font-bold tabular-nums tracking-tight leading-none text-foreground">
                  {fmtRate(rate.rate)}<span className="text-muted-foreground/40 text-[10px] font-normal ml-0.5">원</span>
                </span>
                <span className={`text-[10px] font-medium tabular-nums leading-none ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}>
                  {change != null && change !== 0
                    ? `${isUp ? "▲" : "▼"} ${fmtRate(Math.abs(change))}${rate.change_rate ? ` (${rate.change_rate > 0 ? "+" : ""}${rate.change_rate.toFixed(2)}%)` : ""}`
                    : "— 0"}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 히스토리 Bottom Sheet */}
      {showHistory && createPortal(
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/25" onClick={() => setShowHistory(false)} />
          <div ref={sheetRef} className="relative w-full sm:w-96 sm:max-w-[90vw] max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 animate-slide-in-bottom">
            <div ref={handleRef} className="sm:hidden flex items-center justify-center mb-2 py-3 cursor-grab relative">
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
              <button onClick={() => setShowHistory(false)} className="absolute right-0 text-muted-foreground hover:text-foreground p-1" aria-label="닫기">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">환율 히스토리</span>
              <button onClick={() => setShowHistory(false)} className="hidden sm:block text-muted-foreground hover:text-foreground p-1 -m-1">
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
                          className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${chartCurrency === cur ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground/50 hover:text-muted-foreground/80"}`}
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

                <hr className="border-border/30 my-3" />

                {/* 테이블 */}
                <table className="w-full text-[11px] tabular-nums table-fixed">
                  <colgroup>
                    <col className="w-20" />
                    {historyRows.map(row => <col key={row.currency} />)}
                  </colgroup>
                  <thead>
                    <tr className="text-foreground/80 border-b border-border/30">
                      <th className="text-left py-1.5 pr-2 font-semibold">날짜</th>
                      {historyRows.map((row) => (
                        <th key={row.currency} className="text-right py-1.5 px-1 font-semibold">{row.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dates.map((date, di) => (
                      <tr key={date} className={`border-t border-border/15 ${di % 2 === 1 ? "bg-muted/30" : ""}`}>
                        <td className="py-2 pr-2 text-foreground/70 font-medium align-top whitespace-nowrap">
                          {date.slice(5).replace("-", "/")}
                          {date === TODAY_KST && <span className="ml-1 text-[10px] font-semibold text-primary bg-primary/10 px-1 py-0.5 rounded-full">오늘</span>}
                        </td>
                        {historyRows.map((row) => {
                          const entry = row.entries.find(e => e.date === date)
                          if (!entry) return <td key={row.currency} className="text-right py-2 px-1 text-muted-foreground/30">—</td>
                          const change = entry.change
                          const isUp = change != null && change > 0
                          return (
                            <td key={row.currency} className="text-right py-2 px-1">
                              <div className="text-foreground/80 text-[11px] font-medium">{fmtRate(entry.rate)}</div>
                              {change != null && change !== 0 ? (
                                <div className={`text-[10px] font-semibold ${isUp ? "text-red-500" : "text-blue-500"}`}>
                                  {isUp ? "▲" : "▼"}{Math.abs(change).toFixed(1)}
                                </div>
                              ) : (
                                <div className="text-[10px] text-muted-foreground/30">-</div>
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
