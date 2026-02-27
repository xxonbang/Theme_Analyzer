import { useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn, formatNetBuy, getNetBuyColor } from "@/lib/utils"
import type { InvestorInfo } from "@/types/stock"

interface InvestorChartPopupProps {
  stockName: string
  investorInfo: InvestorInfo
  onClose: () => void
}

const CHART_W = 280
const CHART_H = 120
const PAD = { top: 10, right: 10, bottom: 20, left: 10 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const PLOT_H = CHART_H - PAD.top - PAD.bottom

interface LineData { values: number[]; color: string }

function buildLine(values: number[], allMin: number, allMax: number): string {
  const range = allMax - allMin || 1
  return values.map((v, i) => {
    const x = PAD.left + (i / (values.length - 1)) * PLOT_W
    const y = PAD.top + (1 - (v - allMin) / range) * PLOT_H
    return `${x},${y}`
  }).join(" ")
}

export function InvestorChartPopup({ stockName, investorInfo, onClose }: InvestorChartPopupProps) {
  // 히스토리: 과거→현재 순 (history는 D-1, D-2, ... 순이므로 reverse)
  const history = investorInfo.history ?? []
  const allDays = [
    ...history.slice().reverse(),
    { foreign_net: investorInfo.foreign_net, institution_net: investorInfo.institution_net, individual_net: investorInfo.individual_net },
  ]
  const labels = allDays.map((_, i) => i === allDays.length - 1 ? "D" : `D-${allDays.length - 1 - i}`)

  const foreignVals = allDays.map(d => d.foreign_net)
  const instVals = allDays.map(d => d.institution_net)
  const indivVals = allDays.map(d => d.individual_net ?? 0)

  const allValues = [...foreignVals, ...instVals, ...indivVals]
  const allMin = Math.min(...allValues)
  const allMax = Math.max(...allValues)
  const range = allMax - allMin || 1

  // 0 기준선 Y좌표
  const zeroY = PAD.top + (1 - (0 - allMin) / range) * PLOT_H

  const lines: LineData[] = [
    { values: foreignVals, color: "#ef4444" },
    { values: instVals, color: "#8b5cf6" },
    { values: indivVals, color: "#22c55e" },
  ]

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
      <div className="relative w-full sm:w-96 sm:max-w-[90vw] max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
        {/* 모바일 드래그 핸들 */}
        <div className="sm:hidden flex justify-center mb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-semibold">{stockName}</span>
            <span className="text-xs text-muted-foreground ml-2">수급 추이 ({allDays.length}일)</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SVG 차트 */}
        {allDays.length >= 2 && (
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto mb-2">
            {/* 0 기준선 */}
            <line
              x1={PAD.left} y1={zeroY} x2={CHART_W - PAD.right} y2={zeroY}
              stroke="currentColor" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.3}
            />

            {/* X축 라벨 */}
            {labels.map((label, i) => {
              const x = PAD.left + (i / (labels.length - 1)) * PLOT_W
              return <text key={i} x={x} y={CHART_H - 2} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5}>{label}</text>
            })}

            {/* 라인들 */}
            {lines.map((line, idx) => (
              <polyline
                key={idx}
                points={buildLine(line.values, allMin, allMax)}
                fill="none" stroke={line.color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
              />
            ))}
          </svg>
        )}

        {/* 범례 */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 rounded inline-block" />외국인</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-500 rounded inline-block" />기관</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 rounded inline-block" />개인</span>
        </div>

        {/* 테이블 */}
        <div className="space-y-0">
          <div className="flex items-center text-[9px] text-muted-foreground font-medium pb-1.5 border-b border-border/50">
            <span className="w-8 shrink-0">일자</span>
            <span className="flex-1 text-right">외국인</span>
            <span className="flex-1 text-right">기관</span>
            <span className="flex-1 text-right">개인</span>
          </div>
          {allDays.map((d, idx) => {
            const isToday = idx === allDays.length - 1
            return (
              <div key={idx} className={`flex items-center py-1 text-[10px] ${isToday ? "bg-muted/40 -mx-1 px-1 rounded font-medium" : ""} ${idx < allDays.length - 1 ? "border-b border-border/20" : ""}`}>
                <span className="w-8 shrink-0 text-muted-foreground font-medium">{labels[idx]}</span>
                <span className={cn("flex-1 text-right tabular-nums", getNetBuyColor(d.foreign_net))}>{formatNetBuy(d.foreign_net)}</span>
                <span className={cn("flex-1 text-right tabular-nums", getNetBuyColor(d.institution_net))}>{formatNetBuy(d.institution_net)}</span>
                <span className={cn("flex-1 text-right tabular-nums", getNetBuyColor(d.individual_net ?? 0))}>{d.individual_net != null ? formatNetBuy(d.individual_net) : "-"}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
