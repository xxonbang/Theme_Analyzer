import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronUp, BarChart3, History, X } from "lucide-react"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import type { MacroIndicatorsData } from "@/hooks/useMacroIndicators"
import type { IndicatorHistoryData } from "@/hooks/useIndicatorHistory"

interface MacroIndicatorsProps {
  data: MacroIndicatorsData
  history?: IndicatorHistoryData | null
  historyLoading?: boolean
  onRequestHistory?: () => void
}

const SUMMARY_SYMBOLS = ["NQ=F", "069500", "EWY", "KORU"]
const SHORT_NAMES: Record<string, string> = { "NQ=F": "NQ", "069500": "K200" }

export function MacroIndicators({ data, history, historyLoading, onRequestHistory }: MacroIndicatorsProps) {
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
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

  if (!data?.indicators?.length) return null

  const summaryItems = data.indicators.filter((i) => SUMMARY_SYMBOLS.includes(i.symbol))

  const handleHistoryClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!showHistory && onRequestHistory) onRequestHistory()
    setShowHistory(!showHistory)
  }

  // 히스토리 테이블 데이터: 최근 10일
  const historyRows = history?.macro
    ? data.indicators.map((item) => {
        const entries = (history.macro[item.symbol] || []).slice(-10)
        return { symbol: item.symbol, name: SHORT_NAMES[item.symbol] || item.name, entries }
      })
    : []

  // 날짜 목록 (가장 긴 entries 기준)
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
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <span className="text-xs font-semibold text-foreground/80 ml-1.5">거시지표</span>
          {data.updated_at && (
            <span className="text-[10px] text-muted-foreground/35 tabular-nums ml-1.5">{data.updated_at.slice(5, 10).replace("-", "/")} · {data.updated_at.slice(11, 16)}</span>
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

        {/* 접힌 상태: 4칸 그리드로 전체 너비 활용 */}
        {!expanded && (
          <div className="grid grid-cols-4 gap-px bg-border/30 rounded-md overflow-hidden mt-1">
            {summaryItems.map((item) => {
              const isUp = item.change_pct > 0
              const isDown = item.change_pct < 0
              const name = SHORT_NAMES[item.symbol] || item.name
              return (
                <div
                  key={item.symbol}
                  className={`flex items-center justify-between px-2.5 py-1.5 ${isUp ? "bg-red-500/[0.04]" : isDown ? "bg-blue-500/[0.04]" : "bg-card/80"}`}
                >
                  <span className="text-[10px] text-muted-foreground/55 font-medium">{name}</span>
                  <span className={`text-[11px] tabular-nums font-semibold ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}>
                    {isUp ? "+" : ""}{item.change_pct.toFixed(1)}%
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </button>

      {/* 펼친 상태 */}
      {expanded && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-1.5 px-1">
          {data.indicators.map((item) => {
            const isUp = item.change_pct > 0
            const isDown = item.change_pct < 0
            const priceStr = item.source === "kis_domestic"
              ? item.price.toLocaleString()
              : item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            const accent = isUp ? "border-l-red-500/60" : isDown ? "border-l-blue-500/60" : "border-l-border"

            return (
              <div
                key={item.symbol}
                className={`rounded-md border border-border/50 border-l-2 ${accent} bg-card/60 backdrop-blur-sm px-2.5 py-2 flex flex-col gap-1 transition-colors hover:bg-card`}
              >
                <span className="text-[10px] text-muted-foreground/60 font-medium truncate leading-none">
                  {item.name}
                </span>
                <span className="text-[13px] font-bold tabular-nums tracking-tight leading-none text-foreground">
                  {priceStr}
                </span>
                <span className={`text-[10px] font-medium tabular-nums leading-none ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}>
                  {isUp ? "+" : ""}{item.change_pct.toFixed(2)}%
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
              <span className="text-sm font-semibold">거시지표 히스토리</span>
              <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground p-1 -m-1">
                <X className="w-4 h-4" />
              </button>
            </div>
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
                      <th key={row.symbol} className="text-right py-0.5 px-1 font-medium">{row.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...dates].reverse().map((date) => (
                    <tr key={date} className="border-t border-border/20">
                      <td className="py-0.5 pr-2 text-muted-foreground/60">{date.slice(5).replace("-", "/")}</td>
                      {historyRows.map((row) => {
                        const entry = row.entries.find(e => e.date === date)
                        if (!entry) return <td key={row.symbol} className="text-right py-0.5 px-1 text-muted-foreground/30">—</td>
                        const isUp = entry.change_pct > 0
                        const isDown = entry.change_pct < 0
                        return (
                          <td
                            key={row.symbol}
                            className={`text-right py-0.5 px-1 font-medium ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}
                          >
                            {isUp ? "+" : ""}{entry.change_pct.toFixed(1)}%
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
