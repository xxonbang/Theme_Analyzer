import { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn, formatNetBuy, getNetBuyColor } from "@/lib/utils"
import type { InvestorInfo, InvestorIntraday } from "@/types/stock"

interface InvestorChartPopupProps {
  stockName: string
  investorInfo: InvestorInfo
  stockCode?: string
  investorIntraday?: InvestorIntraday
  onClose: () => void
}

const CHART_W = 280
const CHART_H = 120
const PAD = { top: 10, right: 10, bottom: 20, left: 45 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const PLOT_H = CHART_H - PAD.top - PAD.bottom

interface BarSeries { values: number[]; color: string }

export function InvestorChartPopup({ stockName, investorInfo, stockCode, investorIntraday, onClose }: InvestorChartPopupProps) {
  // === 일봉 데이터 (기존 코드 100% 유지) ===
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

  const zeroY = PAD.top + (1 - (0 - allMin) / range) * PLOT_H

  const series: BarSeries[] = [
    { values: foreignVals, color: "#ef4444" },
    { values: instVals, color: "#8b5cf6" },
    { values: indivVals, color: "#22c55e" },
  ]

  // === 장중 데이터 ===
  const intradaySnapshots = useMemo(() => {
    if (!stockCode || !investorIntraday?.snapshots) return []
    return investorIntraday.snapshots
      .filter(s => s.data[stockCode])
      .map(s => ({ time: s.time, round: s.round, ...s.data[stockCode] }))
  }, [stockCode, investorIntraday])

  const hasIntraday = intradaySnapshots.length >= 2

  const [activeTab, setActiveTab] = useState<"daily" | "intraday">(() => {
    if (!hasIntraday) return "daily"
    const now = new Date()
    const kstHour = (now.getUTCHours() + 9) % 24
    const kstMin = now.getUTCMinutes()
    const kstTime = kstHour * 60 + kstMin
    // 09:00 ~ 15:30 KST → 장중 탭 우선
    return kstTime >= 540 && kstTime <= 930 ? "intraday" : "daily"
  })

  // 장중 차트 데이터
  const intradayChart = useMemo(() => {
    if (intradaySnapshots.length < 2) return null
    const fVals = intradaySnapshots.map(s => s.f)
    const iVals = intradaySnapshots.map(s => s.i)
    const pVals = intradaySnapshots.map(s => s.p ?? 0)
    const all = [...fVals, ...iVals, ...pVals]
    const min = Math.min(...all)
    const max = Math.max(...all)
    const rng = max - min || 1
    const zy = PAD.top + (1 - (0 - min) / rng) * PLOT_H
    const lbls = intradaySnapshots.map(s => s.time)
    return {
      fVals, iVals, pVals, min, max, zeroY: zy, labels: lbls,
      series: [
        { values: fVals, color: "#ef4444" },
        { values: iVals, color: "#8b5cf6" },
        { values: pVals, color: "#22c55e" },
      ] as BarSeries[],
    }
  }, [intradaySnapshots])

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
            <span className="text-xs text-muted-foreground ml-2">
              {activeTab === "daily" ? `수급 추이 (${allDays.length}일)` : `장중 수급 (${intradaySnapshots.length}회)`}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 탭 + 범례 */}
        <div className="flex items-center mb-3">
          {hasIntraday && (
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("daily")}
                className={cn(
                  "px-3 py-1 text-[11px] font-medium rounded-md transition-colors",
                  activeTab === "daily" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                일봉
              </button>
              <button
                onClick={() => setActiveTab("intraday")}
                className={cn(
                  "px-3 py-1 text-[11px] font-medium rounded-md transition-colors",
                  activeTab === "intraday" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                장중
              </button>
            </div>
          )}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground ml-auto">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 rounded inline-block" />외국인</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-500 rounded inline-block" />기관</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 rounded inline-block" />개인</span>
          </div>
        </div>

        {/* === 일봉 탭 (기존 코드 100% 유지) === */}
        {activeTab === "daily" && (
          <>
            {allDays.length >= 2 && (() => {
              const n = allDays.length
              const groupW = PLOT_W / n
              const barW = Math.max(2, groupW * 0.22)
              const gap = Math.max(0.5, barW * 0.15)
              return (
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto mb-2">
                <line
                  x1={PAD.left} y1={zeroY} x2={CHART_W - PAD.right} y2={zeroY}
                  stroke="currentColor" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.3}
                />
                <text x={PAD.left - 3} y={zeroY + 3} textAnchor="end" fontSize={7} fill="currentColor" opacity={0.4}>0</text>
                <text x={PAD.left - 3} y={PAD.top + 3} textAnchor="end" fontSize={7} fill="currentColor" opacity={0.4}>{formatNetBuy(allMax)}</text>
                <text x={PAD.left - 3} y={PAD.top + PLOT_H + 3} textAnchor="end" fontSize={7} fill="currentColor" opacity={0.4}>{formatNetBuy(allMin)}</text>
                {labels.map((label, i) => {
                  const x = PAD.left + (i + 0.5) * groupW
                  return <text key={i} x={x} y={CHART_H - 2} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5}>{label}</text>
                })}
                {/* 좌측/우측 세로선 */}
                <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} stroke="currentColor" strokeWidth={0.3} opacity={0.15} />
                <line x1={CHART_W - PAD.right} y1={PAD.top} x2={CHART_W - PAD.right} y2={PAD.top + PLOT_H} stroke="currentColor" strokeWidth={0.3} opacity={0.15} />
                {series.map((s, si) =>
                  s.values.map((v, di) => {
                    const cx = PAD.left + (di + 0.5) * groupW
                    const x = cx - (series.length * barW + (series.length - 1) * gap) / 2 + si * (barW + gap)
                    const barY = PAD.top + (1 - (v - allMin) / range) * PLOT_H
                    const h = Math.abs(barY - zeroY)
                    return <rect key={`${si}-${di}`} x={x} y={Math.min(barY, zeroY)} width={barW} height={Math.max(h, 0.5)} fill={s.color} rx={0.5} opacity={0.85} />
                  })
                )}
              </svg>
              )
            })()}
            {/* 일봉 테이블 */}
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
          </>
        )}

        {/* === 장중 탭 === */}
        {activeTab === "intraday" && intradayChart && (
          <>
            {(() => {
              const n = intradayChart.labels.length
              const groupW = PLOT_W / n
              const barW = Math.max(2, groupW * 0.22)
              const gap = Math.max(0.5, barW * 0.15)
              const rng = intradayChart.max - intradayChart.min || 1
              return (
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto mb-2">
                <line
                  x1={PAD.left} y1={intradayChart.zeroY} x2={CHART_W - PAD.right} y2={intradayChart.zeroY}
                  stroke="currentColor" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.3}
                />
                <text x={PAD.left - 3} y={intradayChart.zeroY + 3} textAnchor="end" fontSize={7} fill="currentColor" opacity={0.4}>0</text>
                <text x={PAD.left - 3} y={PAD.top + 3} textAnchor="end" fontSize={7} fill="currentColor" opacity={0.4}>{formatNetBuy(intradayChart.max)}</text>
                <text x={PAD.left - 3} y={PAD.top + PLOT_H + 3} textAnchor="end" fontSize={7} fill="currentColor" opacity={0.4}>{formatNetBuy(intradayChart.min)}</text>
                {intradayChart.labels.map((label, i) => {
                  const x = PAD.left + (i + 0.5) * groupW
                  return <text key={i} x={x} y={CHART_H - 2} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5}>{label}</text>
                })}
                {/* 좌측/우측 세로선 */}
                <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} stroke="currentColor" strokeWidth={0.3} opacity={0.15} />
                <line x1={CHART_W - PAD.right} y1={PAD.top} x2={CHART_W - PAD.right} y2={PAD.top + PLOT_H} stroke="currentColor" strokeWidth={0.3} opacity={0.15} />
                {intradayChart.series.map((s, si) =>
                  s.values.map((v, di) => {
                    const cx = PAD.left + (di + 0.5) * groupW
                    const x = cx - (intradayChart.series.length * barW + (intradayChart.series.length - 1) * gap) / 2 + si * (barW + gap)
                    const barY = PAD.top + (1 - (v - intradayChart.min) / rng) * PLOT_H
                    const h = Math.abs(barY - intradayChart.zeroY)
                    return <rect key={`${si}-${di}`} x={x} y={Math.min(barY, intradayChart.zeroY)} width={barW} height={Math.max(h, 0.5)} fill={s.color} rx={0.5} opacity={0.85} />
                  })
                )}
              </svg>
              )
            })()}
            {/* 장중 테이블 */}
            <div className="space-y-0">
              <div className="flex items-center text-[9px] text-muted-foreground font-medium pb-1.5 border-b border-border/50">
                <span className="w-10 shrink-0">시간</span>
                <span className="flex-1 text-right">외국인</span>
                <span className="flex-1 text-right">기관</span>
                <span className="flex-1 text-right">개인</span>
              </div>
              {intradaySnapshots.map((s, idx) => {
                const isLast = idx === intradaySnapshots.length - 1
                return (
                  <div key={idx} className={`flex items-center py-1 text-[10px] ${isLast ? "bg-muted/40 -mx-1 px-1 rounded font-medium" : ""} ${idx < intradaySnapshots.length - 1 ? "border-b border-border/20" : ""}`}>
                    <span className="w-10 shrink-0 text-muted-foreground font-medium">{s.time}</span>
                    <span className={cn("flex-1 text-right tabular-nums", getNetBuyColor(s.f))}>{formatNetBuy(s.f)}</span>
                    <span className={cn("flex-1 text-right tabular-nums", getNetBuyColor(s.i))}>{formatNetBuy(s.i)}</span>
                    <span className={cn("flex-1 text-right tabular-nums", s.p != null ? getNetBuyColor(s.p) : "text-muted-foreground")}>{s.p != null ? formatNetBuy(s.p) : "-"}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

      </div>
    </div>,
    document.body
  )
}
