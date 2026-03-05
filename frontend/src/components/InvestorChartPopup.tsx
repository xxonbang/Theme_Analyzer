import { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
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

const CHART_W = 300
const CHART_H = 150
const PAD = { top: 10, right: 30, bottom: 20, left: 30 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const PLOT_H = CHART_H - PAD.top - PAD.bottom

interface LineSeries { values: number[]; color: string }

function buildLine(values: number[], allMin: number, allMax: number): string {
  const range = allMax - allMin || 1
  const len = values.length > 1 ? values.length - 1 : 1
  return values.map((v, i) => {
    const x = PAD.left + (i / len) * PLOT_W
    const y = PAD.top + (1 - (v - allMin) / range) * PLOT_H
    return `${x},${y}`
  }).join(" ")
}

export function InvestorChartPopup({ stockName, investorInfo, stockCode, investorIntraday, onClose }: InvestorChartPopupProps) {
  const { handleRef, sheetRef } = useSwipeToDismiss(onClose)

  // === 일봉 데이터 ===
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

  const series: LineSeries[] = [
    { values: foreignVals, color: "#ef4444" },
    { values: instVals, color: "#8b5cf6" },
    { values: indivVals, color: "#22c55e" },
  ]

  // === 장중 데이터 (오늘 날짜만 표시) ===
  const intradaySnapshots = useMemo(() => {
    if (!stockCode || !investorIntraday?.snapshots) return []
    // 어제 이전 데이터가 장중 탭에 표시되지 않도록 날짜 체크
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    if (investorIntraday.date !== todayStr) return []
    return investorIntraday.snapshots
      .filter(s => s.data[stockCode])
      .map(s => ({ time: s.time, round: s.round, ...s.data[stockCode] }))
  }, [stockCode, investorIntraday])

  const hasIntraday = intradaySnapshots.length >= 1
  const hasHistory = history.length > 0
  const [showCr, setShowCr] = useState(true)
  const [visibleLines, setVisibleLines] = useState({ f: true, i: true, p: true })

  const [activeTab, setActiveTab] = useState<"daily" | "intraday">(() => {
    // history 없고 장중 데이터만 있으면 → 장중 탭 기본
    if (!hasHistory && hasIntraday) return "intraday"
    if (!hasIntraday) return "daily"
    const now = new Date()
    const kstHour = (now.getUTCHours() + 9) % 24
    const kstMin = now.getUTCMinutes()
    const kstTime = kstHour * 60 + kstMin
    return kstTime >= 540 && kstTime <= 930 ? "intraday" : "daily"
  })

  // 장중 차트 데이터
  const intradayChart = useMemo(() => {
    if (intradaySnapshots.length === 0) return null
    const fVals = intradaySnapshots.map(s => s.f)
    const iVals = intradaySnapshots.map(s => s.i)
    const pVals = intradaySnapshots.map(s => s.p ?? 0)
    const all = [...fVals, ...iVals, ...pVals]
    const min = Math.min(...all)
    const max = Math.max(...all)
    const rng = max - min || 1
    const zy = PAD.top + (1 - (0 - min) / rng) * PLOT_H
    const lbls = intradaySnapshots.map(s => s.time)

    // 등락률 (독립 스케일)
    const crVals = intradaySnapshots.map(s => s.cr ?? 0)
    const hasCr = intradaySnapshots.some(s => s.cr != null)
    let crMin = Math.min(...crVals)
    let crMax = Math.max(...crVals)
    // 범위가 너무 좁으면 ±1% 패딩 (Y축 레이블이 모두 동일해지는 문제 방지)
    if (crMax - crMin < 2) {
      const crMid = (crMax + crMin) / 2
      crMin = crMid - 1
      crMax = crMid + 1
    }
    const crRange = crMax - crMin

    return {
      fVals, iVals, pVals, min, max, range: rng, zeroY: zy, labels: lbls,
      crVals, hasCr, crMin, crMax, crRange,
      series: [
        { values: fVals, color: "#ef4444" },
        { values: iVals, color: "#8b5cf6" },
        { values: pVals, color: "#22c55e" },
      ] as LineSeries[],
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
      <div ref={sheetRef} className="relative w-full sm:w-96 sm:max-w-[90vw] max-h-[85vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
        {/* 모바일 드래그 핸들 */}
        <div ref={handleRef} className="sm:hidden flex justify-center mb-2 py-3 cursor-grab">
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
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground ml-auto">
            {([
              { key: "f" as const, label: "외국인", color: "bg-red-500" },
              { key: "i" as const, label: "기관", color: "bg-violet-500" },
              { key: "p" as const, label: "개인", color: "bg-green-500" },
            ]).map(({ key, label, color }) => {
              const isActive = visibleLines[key]
              return (
                <span
                  key={key}
                  onClick={() => setVisibleLines(v => ({ ...v, [key]: !v[key] }))}
                  className={cn(
                    "flex items-center gap-1 transition-opacity cursor-pointer select-none",
                    !isActive && "opacity-30"
                  )}
                >
                  <span className={cn("w-3 h-0.5 rounded inline-block", isActive ? color : "bg-muted-foreground")} />
                  {label}
                </span>
              )
            })}
            {activeTab === "intraday" && intradayChart?.hasCr && (
              <span
                onClick={() => setShowCr(v => !v)}
                className={cn(
                  "flex items-center gap-1 cursor-pointer select-none transition-opacity",
                  !showCr && "opacity-30"
                )}
              >
                <span className="w-3 h-0.5 rounded inline-block" style={{ background: showCr ? "#f59e0b" : "#94a3b8" }} />
                등락률
              </span>
            )}
          </div>
        </div>

        {/* === 일봉 탭 === */}
        {activeTab === "daily" && (
          <>
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto mb-2">
              {/* 0선 */}
              <line x1={PAD.left} y1={zeroY} x2={CHART_W - PAD.right} y2={zeroY}
                stroke="currentColor" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.3}
              />
              {/* Y축 라벨 + 그리드 */}
              {[0, 0.25, 0.5, 0.75, 1].map(r => {
                const y = PAD.top + r * PLOT_H
                const val = allMax - r * (allMax - allMin)
                return (
                  <g key={r}>
                    <line x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y} stroke="currentColor" strokeWidth={0.3} opacity={0.15} />
                    <text x={PAD.left - 3} y={y + 3} textAnchor="end" fontSize={7} fill="currentColor" opacity={0.4}>{formatNetBuy(val)}</text>
                    <text x={CHART_W - PAD.right + 3} y={y + 3} textAnchor="start" fontSize={7} fill="currentColor" opacity={0.4}>{formatNetBuy(val)}</text>
                  </g>
                )
              })}
              {/* 좌측/우측 세로선 */}
              <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} stroke="currentColor" strokeWidth={0.5} opacity={0.25} />
              <line x1={CHART_W - PAD.right} y1={PAD.top} x2={CHART_W - PAD.right} y2={PAD.top + PLOT_H} stroke="currentColor" strokeWidth={0.5} opacity={0.25} />
              {/* X축 라벨 */}
              {labels.map((label, i) => {
                const x = PAD.left + (i / Math.max(labels.length - 1, 1)) * PLOT_W
                return <text key={i} x={x} y={CHART_H - 2} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5}>{label}</text>
              })}
              {/* 꺾은선 */}
              {series.map((s, idx) => {
                const key = (["f", "i", "p"] as const)[idx]
                if (!visibleLines[key]) return null
                return (
                  <polyline key={idx} points={buildLine(s.values, allMin, allMax)}
                    fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  />
                )
              })}
              {/* 데이터 포인트 */}
              {series.map((s, si) => {
                const key = (["f", "i", "p"] as const)[si]
                if (!visibleLines[key]) return null
                return s.values.map((v, di) => {
                  const x = PAD.left + (di / Math.max(s.values.length - 1, 1)) * PLOT_W
                  const y = PAD.top + (1 - (v - allMin) / range) * PLOT_H
                  return <circle key={`${si}-${di}`} cx={x} cy={y} r={2} fill={s.color} />
                })
              })}
            </svg>
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
        {activeTab === "intraday" && !hasIntraday && (
          <div className="text-center text-xs text-muted-foreground py-8">장중 수급 데이터 없음</div>
        )}
        {activeTab === "intraday" && hasIntraday && (
          <>
            {intradayChart && (
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto mb-2">
                {/* 0선 */}
                <line x1={PAD.left} y1={intradayChart.zeroY} x2={CHART_W - PAD.right} y2={intradayChart.zeroY}
                  stroke="currentColor" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.3}
                />
                {/* Y축 라벨 + 그리드 */}
                {[0, 0.25, 0.5, 0.75, 1].map(r => {
                  const y = PAD.top + r * PLOT_H
                  const val = intradayChart.max - r * (intradayChart.max - intradayChart.min)
                  const crVal = intradayChart.hasCr ? intradayChart.crMax - r * (intradayChart.crMax - intradayChart.crMin) : 0
                  return (
                    <g key={r}>
                      <line x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y} stroke="currentColor" strokeWidth={0.3} opacity={0.15} />
                      <text x={PAD.left - 3} y={y + 3} textAnchor="end" fontSize={7} fill="currentColor" opacity={0.4}>{formatNetBuy(val)}</text>
                      {intradayChart.hasCr && showCr ? (
                        <text x={CHART_W - PAD.right + 3} y={y + 3} textAnchor="start" fontSize={7} fill="#f59e0b" opacity={0.7}>{crVal.toFixed(1)}%</text>
                      ) : (
                        <text x={CHART_W - PAD.right + 3} y={y + 3} textAnchor="start" fontSize={7} fill="currentColor" opacity={0.4}>{formatNetBuy(val)}</text>
                      )}
                    </g>
                  )
                })}
                {/* 좌측/우측 세로선 */}
                <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} stroke="currentColor" strokeWidth={0.5} opacity={0.25} />
                <line x1={CHART_W - PAD.right} y1={PAD.top} x2={CHART_W - PAD.right} y2={PAD.top + PLOT_H} stroke="currentColor" strokeWidth={0.5} opacity={0.25} />
                {/* X축 라벨 */}
                {intradayChart.labels.map((label, i) => {
                  const x = PAD.left + (i / (intradayChart.labels.length - 1)) * PLOT_W
                  return <text key={i} x={x} y={CHART_H - 2} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5}>{label}</text>
                })}
                {/* 꺾은선 (수급) */}
                {intradayChart.series.map((s, idx) => {
                  const key = (["f", "i", "p"] as const)[idx]
                  if (!visibleLines[key]) return null
                  return (
                    <polyline key={idx} points={buildLine(s.values, intradayChart.min, intradayChart.max)}
                      fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                    />
                  )
                })}
                {/* 등락률 polyline (우축 독립 스케일) */}
                {intradayChart.hasCr && showCr && (
                  <polyline
                    points={buildLine(intradayChart.crVals, intradayChart.crMin, intradayChart.crMax)}
                    fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,2" strokeLinecap="round" strokeLinejoin="round"
                  />
                )}
                {/* 데이터 포인트 */}
                {intradayChart.series.map((s, si) => {
                  const key = (["f", "i", "p"] as const)[si]
                  if (!visibleLines[key]) return null
                  return s.values.map((v, di) => {
                    const x = PAD.left + (di / Math.max(s.values.length - 1, 1)) * PLOT_W
                    const y = PAD.top + (1 - (v - intradayChart.min) / intradayChart.range) * PLOT_H
                    return <circle key={`${si}-${di}`} cx={x} cy={y} r={2.5} fill={s.color} />
                  })
                })}
              </svg>
            )}
            {/* 장중 테이블 */}
            <div className="space-y-0">
              <div className="flex items-center text-[9px] text-muted-foreground font-medium pb-1.5 border-b border-border/50">
                <span className="w-10 shrink-0">시간</span>
                <span className="flex-1 text-right">외국인</span>
                <span className="flex-1 text-right">기관</span>
                <span className="flex-1 text-right">개인</span>
                {intradayChart?.hasCr && showCr && <span className="w-14 shrink-0 text-right">등락률</span>}
              </div>
              {intradaySnapshots.map((s, idx) => {
                const isLast = idx === intradaySnapshots.length - 1
                const hasCrCol = intradayChart?.hasCr && showCr
                return (
                  <div key={idx} className={`flex items-center py-1 text-[10px] ${isLast ? "bg-muted/40 -mx-1 px-1 rounded font-medium" : ""} ${idx < intradaySnapshots.length - 1 ? "border-b border-border/20" : ""}`}>
                    <span className="w-10 shrink-0 text-muted-foreground font-medium">{s.time}</span>
                    <span className={cn("flex-1 text-right tabular-nums", getNetBuyColor(s.f))}>{formatNetBuy(s.f)}</span>
                    <span className={cn("flex-1 text-right tabular-nums", getNetBuyColor(s.i))}>{formatNetBuy(s.i)}</span>
                    <span className={cn("flex-1 text-right tabular-nums", s.p != null ? getNetBuyColor(s.p) : "text-muted-foreground")}>{s.p != null ? formatNetBuy(s.p) : "-"}</span>
                    {hasCrCol && (
                      <span className={cn("w-14 shrink-0 text-right tabular-nums", s.cr != null && s.cr > 0 ? "text-red-500" : s.cr != null && s.cr < 0 ? "text-blue-500" : "text-muted-foreground")}>
                        {s.cr != null ? `${s.cr > 0 ? "+" : ""}${s.cr.toFixed(2)}%` : "-"}
                      </span>
                    )}
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
