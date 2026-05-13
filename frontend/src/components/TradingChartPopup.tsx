import { useState, useMemo } from "react"
import { createPortal } from "react-dom"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { useScrollLock } from "@/hooks/useScrollLock"
import { X } from "lucide-react"
import { cn, formatTradingValue, formatVolume } from "@/lib/utils"
import type { HistoryChange, IntradayDay } from "@/types/stock"

interface TradingChartPopupProps {
  stockName: string
  currentTradingValue?: number
  currentVolume: number
  changes: HistoryChange[]
  intradayDays?: IntradayDay[]
  onClose: () => void
}

const CHART_W = 310
const CHART_H = 120
const PAD = { top: 10, right: 30, bottom: 20, left: 30 }
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

export function TradingChartPopup({ stockName, currentTradingValue, currentVolume, changes, intradayDays, onClose }: TradingChartPopupProps) {
  const { handleRef, sheetRef } = useSwipeToDismiss(onClose)

  // 시간순 정렬, 최근 11일(D ~ D-10)만 표시
  const reversed = [...changes].slice(0, 11).reverse()
  const labels = reversed.map((_, i) => i === reversed.length - 1 ? "D" : `D-${reversed.length - 1 - i}`)

  const tradingValues = reversed.map((c, i) =>
    i === reversed.length - 1 ? (currentTradingValue ?? c.trading_value ?? 0) : (c.trading_value ?? 0)
  )
  const volumes = reversed.map((c, i) =>
    i === reversed.length - 1 ? currentVolume : (c.volume ?? 0)
  )

  // === 장중 데이터: 오늘자 entry만 ===
  const todayKST = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }, [])
  const todayEntry = useMemo(() => {
    if (!intradayDays) return null
    return intradayDays.find(e => e.date === todayKST) ?? null
  }, [intradayDays, todayKST])
  const hasIntraday = !!todayEntry && (todayEntry.intervals_30m?.length ?? 0) > 0

  const [activeTab, setActiveTab] = useState<"daily" | "intraday">(() => {
    if (!hasIntraday) return "daily"
    const now = new Date()
    const kstMin = now.getHours() * 60 + now.getMinutes()
    return kstMin >= 540 && kstMin <= 930 ? "intraday" : "daily"
  })
  const [interval, setInterval] = useState<"30m" | "60m">("30m")

  // 장중 슬롯: 현재 시각 이후 슬롯 제외
  const intradaySlots = useMemo(() => {
    if (!todayEntry) return []
    const raw = interval === "30m" ? todayEntry.intervals_30m : todayEntry.intervals_60m
    if (!raw) return []
    if (todayEntry.date !== todayKST) return raw
    const now = new Date()
    const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    return raw.filter(s => s.time <= nowHHMM)
  }, [todayEntry, interval, todayKST])

  useScrollLock(true)

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div ref={sheetRef} className="relative w-full sm:w-96 sm:max-w-[90vw] max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
        {/* 모바일 드래그 핸들 + 닫기 */}
        <div ref={handleRef} className="sm:hidden flex items-center justify-center mb-2 py-3 cursor-grab relative sticky top-0 bg-popover z-10">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
          <button onClick={onClose} className="absolute right-0 text-muted-foreground hover:text-foreground p-1" aria-label="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{stockName}</span>
          <button onClick={onClose} className="hidden sm:block text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setActiveTab("daily")}
            className={cn(
              "px-3 py-1 text-[11px] font-medium rounded-md transition-colors",
              activeTab === "daily" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            일별
          </button>
          <button
            onClick={() => hasIntraday ? setActiveTab("intraday") : undefined}
            className={cn(
              "px-3 py-1 text-[11px] font-medium rounded-md transition-colors",
              !hasIntraday ? "text-muted-foreground/40 cursor-not-allowed" :
              activeTab === "intraday" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            장중{!hasIntraday && <span className="text-[10px] ml-1">(수집 전)</span>}
          </button>
        </div>

        {/* === 일별 탭 === */}
        {activeTab === "daily" && (
          <>
            <div className="text-xs text-muted-foreground mb-2">거래 추이 ({reversed.length}일)</div>
            {/* SVG 차트 */}
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto mb-2">
              {[0, 0.25, 0.5, 0.75, 1].map(r => {
                const y = PAD.top + r * PLOT_H
                const tvMax = Math.max(...tradingValues)
                const tvMin = Math.min(...tradingValues)
                const tvVal = tvMax - r * (tvMax - tvMin)
                const volMax = Math.max(...volumes)
                const volMin = Math.min(...volumes)
                const volVal = volMax - r * (volMax - volMin)
                return (
                  <g key={r}>
                    <line x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y} stroke="currentColor" strokeWidth={0.3} opacity={0.15} />
                    <text x={PAD.left - 3} y={y + 3} textAnchor="end" fontSize={8} fill="#e11d48" opacity={0.7}>{formatTradingValue(tvVal)}</text>
                    <text x={CHART_W - PAD.right + 3} y={y + 3} textAnchor="start" fontSize={8} fill="#6366f1" opacity={0.6}>{formatVolume(volVal)}</text>
                  </g>
                )
              })}
              {labels.map((label, i) => {
                const x = PAD.left + (i / (labels.length - 1)) * PLOT_W
                return <text key={i} x={x} y={CHART_H - 2} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5}>{label}</text>
              })}
              <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} stroke="currentColor" strokeWidth={0.5} opacity={0.25} />
              <line x1={CHART_W - PAD.right} y1={PAD.top} x2={CHART_W - PAD.right} y2={PAD.top + PLOT_H} stroke="currentColor" strokeWidth={0.5} opacity={0.25} />
              <polyline points={buildLine(tradingValues, PLOT_W, PLOT_H, PAD.left, PAD.top)} fill="none" stroke="#e11d48" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={buildLine(volumes, PLOT_W, PLOT_H, PAD.left, PAD.top)} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-rose-600 rounded inline-block" />거래대금</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 rounded inline-block" />거래량</span>
            </div>

            <div className="space-y-0">
              <div className="flex items-center text-[10px] text-muted-foreground font-medium pb-1.5 border-b border-border/50">
                <span className="w-8 shrink-0">일자</span>
                <span className="flex-1 text-right">거래대금</span>
                <span className="flex-1 text-right">거래량</span>
              </div>
              {reversed.map((c, idx) => {
                const isToday = idx === reversed.length - 1
                return (
                  <div key={idx} className={cn(
                    "flex items-center py-1 text-[10px]",
                    isToday && "bg-muted/40 -mx-1 px-1 rounded font-medium",
                    idx < reversed.length - 1 && "border-b border-border/20"
                  )}>
                    <span className="w-8 shrink-0 text-muted-foreground font-medium">{labels[idx]}</span>
                    <span className="flex-1 text-right tabular-nums text-rose-600">
                      {isToday ? formatTradingValue(currentTradingValue ?? 0) : formatTradingValue(c.trading_value ?? 0)}
                    </span>
                    <span className="flex-1 text-right tabular-nums text-indigo-600">
                      {isToday ? formatVolume(currentVolume) : formatVolume(c.volume ?? 0)}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* === 장중 탭 === */}
        {activeTab === "intraday" && todayEntry && (
          <>
            {/* 30m / 1h 토글 */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">{todayKST.replace(/-/g, ".")} 장중</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setInterval("30m")}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
                    interval === "30m" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >30분</button>
                <button
                  onClick={() => setInterval("60m")}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
                    interval === "60m" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >1시간</button>
              </div>
            </div>

            {intradaySlots.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-6">데이터 없음</div>
            ) : (
              <>
                {/* mini bar chart × 2 — 그라데이션 막대 + 점선 누적 라인 (popup padding 외부로 확장) */}
                {(() => {
                  const tvVals = intradaySlots.map(s => s.trading_value ?? 0)
                  const volVals = intradaySlots.map(s => s.volume ?? 0)
                  const tvMax = Math.max(...tvVals, 1)
                  const volMax = Math.max(...volVals, 1)
                  // viewBox 폭 확대 (음수 마진으로 popup padding 외부 확장 — 좌우 여백 본질 해결)
                  const W = 360
                  const BH = 120
                  // Y라벨을 그리드 라인 위 inline으로 → BPAD.left 최소화
                  const BPAD = { top: 28, right: 8, bottom: 26, left: 8 }
                  const BPW = W - BPAD.left - BPAD.right
                  const BPH = BH - BPAD.top - BPAD.bottom
                  const n = intradaySlots.length
                  const barW = Math.min((BPW / Math.max(n, 1)) * 0.55, 14)
                  const innerLeft = BPAD.left + barW / 2
                  const innerW = BPW - barW
                  const slotX = (i: number) => innerLeft + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2)
                  const xLabelIdxs: number[] = []
                  intradaySlots.forEach((s, i) => {
                    if (s.time.endsWith(":00")) xLabelIdxs.push(i)
                  })

                  const renderMini = (vals: number[], maxV: number, color: string, axisLabel: string, fmt: (v: number) => string) => {
                    const cum: number[] = []
                    let acc = 0
                    for (const v of vals) { acc += v; cum.push(acc) }
                    const cumMax = acc || 1
                    const cumPoints = cum.map((v, i) => {
                      const cx = slotX(i)
                      const cy = BPAD.top + BPH - (v / cumMax) * BPH
                      return `${cx},${cy}`
                    }).join(" ")
                    const gradId = `bar-grad-${color.replace("#", "")}`

                    return (
                      <svg viewBox={`0 0 ${W} ${BH}`} className="w-full h-auto mb-5 -mx-4 sm:-mx-5" style={{ width: "calc(100% + 2rem)", height: BH + 4 }} preserveAspectRatio="none">
                        <defs>
                          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.55} />
                          </linearGradient>
                        </defs>
                        {/* axisLabel — 좌측 상단 */}
                        <text x={BPAD.left} y={14} fontSize={11} fill={color} fontWeight={600} style={{ letterSpacing: "0.02em" }}>
                          {axisLabel}
                          <tspan fontSize={9} fontWeight={400} dx={8} opacity={0.7}>누적 {fmt(cumMax)}</tspan>
                        </text>
                        {/* 그리드 + Y라벨 (라인 직상단 inline, textAnchor start) */}
                        {[0, 0.5, 1].map(r => {
                          const y = BPAD.top + r * BPH
                          const v = maxV * (1 - r)
                          return (
                            <g key={r}>
                              <line x1={BPAD.left} y1={y} x2={W - BPAD.right} y2={y} stroke="currentColor" strokeWidth={0.4} opacity={0.08} strokeDasharray={r === 1 ? "0" : "2 3"} />
                              <text x={BPAD.left + 2} y={y - 3} textAnchor="start" fontSize={8.5} fill="currentColor" opacity={0.5} fontWeight={500}>{fmt(v)}</text>
                            </g>
                          )
                        })}
                        {/* 막대 (그라데이션 fill, 둥근 모서리) */}
                        {vals.map((v, i) => {
                          const cx = slotX(i)
                          const h = maxV > 0 ? (v / maxV) * BPH : 0
                          const y = BPAD.top + BPH - h
                          return v > 0 ? (
                            <rect key={i} x={cx - barW / 2} y={y} width={barW} height={h} fill={`url(#${gradId})`} rx={2} />
                          ) : null
                        })}
                        {/* 누적 라인 (점선, 부드러운 오버레이) */}
                        <polyline points={cumPoints} fill="none" stroke={color} strokeWidth={2} strokeDasharray="3 3" opacity={0.55} strokeLinecap="round" strokeLinejoin="round" />
                        {/* X축 라벨 */}
                        {xLabelIdxs.map(i => (
                          <text key={i} x={slotX(i)} y={BH - 8} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.5} style={{ letterSpacing: "0.04em" }}>
                            {intradaySlots[i].time}
                          </text>
                        ))}
                      </svg>
                    )
                  }

                  return (
                    <>
                      {renderMini(tvVals, tvMax, "#e11d48", "거래대금", formatTradingValue)}
                      {renderMini(volVals, volMax, "#6366f1", "거래량", formatVolume)}
                    </>
                  )
                })()}

                {/* 표 */}
                <div className="space-y-0 mt-2">
                  <div className="flex items-center text-[10px] text-muted-foreground font-medium pb-2 border-b border-border/50">
                    <span className="w-10 shrink-0">시간</span>
                    <span className="flex-1 text-right">거래대금</span>
                    <span className="flex-1 text-right">거래량</span>
                  </div>
                  {intradaySlots.map((s, idx) => (
                    <div key={s.time} className={cn(
                      "flex items-center py-1.5 text-[10px]",
                      idx === 0 && "bg-muted/40 -mx-1 px-1 rounded font-medium",
                      idx > 0 && "border-b border-border/20"
                    )}>
                      <span className="w-10 shrink-0 text-muted-foreground font-semibold tabular-nums">{s.time}</span>
                      <span className="flex-1 text-right tabular-nums text-rose-600">
                        {formatTradingValue(s.trading_value ?? 0)}
                      </span>
                      <span className="flex-1 text-right tabular-nums text-indigo-600">
                        {formatVolume(s.volume ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
