import { useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { formatTradingValue, formatVolume } from "@/lib/utils"
import type { HistoryChange } from "@/types/stock"

interface TradingChartPopupProps {
  stockName: string
  currentTradingValue?: number
  currentVolume: number
  changes: HistoryChange[]
  onClose: () => void
}

const CHART_W = 280
const CHART_H = 120
const PAD = { top: 10, right: 10, bottom: 20, left: 10 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const PLOT_H = CHART_H - PAD.top - PAD.bottom

function buildLine(values: number[], plotW: number, plotH: number, padLeft: number, padTop: number): string {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values.map((v, i) => {
    const x = padLeft + (i / (values.length - 1)) * plotW
    const y = padTop + (1 - (v - min) / range) * plotH
    return `${x},${y}`
  }).join(" ")
}

export function TradingChartPopup({ stockName, currentTradingValue, currentVolume, changes, onClose }: TradingChartPopupProps) {
  // 시간순 정렬 (과거→현재)
  const reversed = [...changes].reverse()
  const labels = reversed.map((_, i) => i === reversed.length - 1 ? "D" : `D-${reversed.length - 1 - i}`)

  const tradingValues = reversed.map((c, i) =>
    i === reversed.length - 1 ? (currentTradingValue ?? c.trading_value ?? 0) : (c.trading_value ?? 0)
  )
  const volumes = reversed.map((c, i) =>
    i === reversed.length - 1 ? currentVolume : (c.volume ?? 0)
  )

  useEffect(() => {
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
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-full sm:w-96 sm:max-w-[90vw] max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
        {/* 모바일 드래그 핸들 */}
        <div className="sm:hidden flex justify-center mb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-semibold">{stockName}</span>
            <span className="text-xs text-muted-foreground ml-2">거래 추이 ({reversed.length}일)</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SVG 차트 */}
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto mb-2">
          {/* 그리드 */}
          {[0, 0.5, 1].map(r => {
            const y = PAD.top + r * PLOT_H
            return <line key={r} x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y} stroke="currentColor" strokeWidth={0.3} opacity={0.15} />
          })}

          {/* X축 라벨 */}
          {labels.map((label, i) => {
            const x = PAD.left + (i / (labels.length - 1)) * PLOT_W
            return <text key={i} x={x} y={CHART_H - 2} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5}>{label}</text>
          })}

          {/* 거래대금 라인 */}
          <polyline
            points={buildLine(tradingValues, PLOT_W, PLOT_H, PAD.left, PAD.top)}
            fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
          />
          {/* 거래량 라인 */}
          <polyline
            points={buildLine(volumes, PLOT_W, PLOT_H, PAD.left, PAD.top)}
            fill="none" stroke="#6366f1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>

        {/* 범례 */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 rounded inline-block" />거래대금</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 rounded inline-block" />거래량</span>
        </div>

        {/* 테이블 */}
        <div className="space-y-0">
          <div className="flex items-center text-[9px] text-muted-foreground font-medium pb-1.5 border-b border-border/50">
            <span className="w-8 shrink-0">일자</span>
            <span className="flex-1 text-right">거래대금</span>
            <span className="flex-1 text-right">거래량</span>
          </div>
          {reversed.map((c, idx) => {
            const isToday = idx === reversed.length - 1
            return (
              <div key={idx} className={`flex items-center py-1 text-[10px] ${isToday ? "bg-muted/40 -mx-1 px-1 rounded font-medium" : ""} ${idx < reversed.length - 1 ? "border-b border-border/20" : ""}`}>
                <span className="w-8 shrink-0 text-muted-foreground font-medium">{labels[idx]}</span>
                <span className="flex-1 text-right tabular-nums text-amber-600">
                  {isToday ? formatTradingValue(currentTradingValue ?? 0) : formatTradingValue(c.trading_value ?? 0)}
                </span>
                <span className="flex-1 text-right tabular-nums text-indigo-600">
                  {isToday ? formatVolume(currentVolume) : formatVolume(c.volume ?? 0)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
