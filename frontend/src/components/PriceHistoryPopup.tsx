import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { cn, formatPrice, formatVolume, formatTradingValue, getChangeBgColor } from "@/lib/utils"
import type { HistoryChange, IntradayDay } from "@/types/stock"

// 차트 상수
const CW = 300
const CH = 140
const PAD = { top: 14, right: 8, bottom: 24, left: 42 }
const PW = CW - PAD.left - PAD.right
const PH = CH - PAD.top - PAD.bottom

function buildPoints(values: number[], min: number, max: number): string {
  const range = max - min || 1
  const len = values.length > 1 ? values.length - 1 : 1
  return values.map((v, i) => {
    const x = PAD.left + (i / len) * PW
    const y = PAD.top + PH - ((v - min) / range) * PH
    return `${x},${y}`
  }).join(" ")
}

function pointCoords(values: number[], min: number, max: number): { x: number; y: number }[] {
  const range = max - min || 1
  const len = values.length > 1 ? values.length - 1 : 1
  return values.map((v, i) => ({
    x: PAD.left + (i / len) * PW,
    y: PAD.top + PH - ((v - min) / range) * PH,
  }))
}

interface PriceHistoryPopupProps {
  stockName: string
  currentPrice: number
  currentChangeRate: number
  changes: HistoryChange[]
  intradayDays?: IntradayDay[]
  onClose: () => void
}

export function PriceHistoryPopup({ stockName, currentPrice, currentChangeRate, changes, intradayDays, onClose }: PriceHistoryPopupProps) {
  const { handleRef, sheetRef } = useSwipeToDismiss(onClose)

  // 시간순 정렬, 최근 11일(D-10 ~ D)만 표시
  const reversed = [...changes].slice(0, 11).reverse()

  // 탭 상태
  const hasIntraday = intradayDays && intradayDays.length > 0
  const [activeTab, setActiveTab] = useState<"daily" | "intraday">("daily")
  const [interval, setInterval] = useState<"30m" | "60m">("30m")
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)

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

  // 장중 선택된 날짜 데이터
  const selectedDay = hasIntraday ? intradayDays[selectedDayIdx] : null
  const intervals = selectedDay
    ? (interval === "30m" ? selectedDay.intervals_30m : selectedDay.intervals_60m)
    : []

  // 날짜 포맷 (2026-03-09 → 2026.03.09)
  const formatDate = (date: string) => {
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
    const d = new Date(date)
    const day = weekdays[d.getDay()]
    return `${date.replace(/-/g, ".")} (${day})`
  }

  return createPortal(
    <div className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />

      <div ref={sheetRef} className="relative w-full sm:w-[28rem] sm:max-w-[90vw] max-h-[85vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
        {/* 모바일 드래그 핸들 */}
        <div ref={handleRef} className="sm:hidden flex justify-center mb-2 py-1 cursor-grab">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm font-semibold">{stockName}</span>
            {activeTab === "daily" && (
              <span className="text-xs text-muted-foreground ml-2">최근 {reversed.length}일 변동</span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 탭 */}
        {hasIntraday && (
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

        {/* === 일별 탭 === */}
        {activeTab === "daily" && (
          <>
            {/* 종가 꺾은선 그래프 */}
            {(() => {
              const data = reversed.map((c, idx) => ({
                close: idx === reversed.length - 1 ? currentPrice : (c.close || 0),
                label: idx === reversed.length - 1 ? "D" : `D-${reversed.length - 1 - idx}`,
              })).filter(d => d.close > 0)
              if (data.length < 2) return null
              const closes = data.map(d => d.close)
              const minV = Math.min(...closes)
              const maxV = Math.max(...closes)
              const pts = pointCoords(closes, minV, maxV)
              const up = closes[closes.length - 1] >= closes[0]
              const color = up ? "#ef4444" : "#3b82f6"
              const xLabels = [0, Math.floor((data.length - 1) / 2), data.length - 1]
              const midV = (minV + maxV) / 2
              const yTicks = [maxV, midV, minV]
              return (
                <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full mb-2" style={{ height: 140 }}>
                  {/* 가로 그리드라인 + Y축 라벨 */}
                  {yTicks.map((v, i) => {
                    const y = PAD.top + PH - ((v - minV) / ((maxV - minV) || 1)) * PH
                    return (
                      <g key={`yg-${i}`}>
                        <line x1={PAD.left} y1={y} x2={CW - PAD.right} y2={y}
                          stroke="currentColor" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.15} />
                        <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="currentColor" opacity={0.5} fontSize={9}>
                          {formatPrice(Math.round(v))}
                        </text>
                      </g>
                    )
                  })}
                  {/* 세로 그리드라인 */}
                  {data.map((_, i) => {
                    const x = PAD.left + (i / Math.max(data.length - 1, 1)) * PW
                    return (
                      <line key={`xg-${i}`} x1={x} y1={PAD.top} x2={x} y2={CH - PAD.bottom}
                        stroke="currentColor" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.15} />
                    )
                  })}
                  {/* 선 */}
                  <polyline points={buildPoints(closes, minV, maxV)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  {/* 포인트 */}
                  {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
                  ))}
                  {/* X축 라벨 */}
                  {xLabels.map(i => (
                    <text key={i} x={PAD.left + (i / Math.max(data.length - 1, 1)) * PW} y={CH - 4} textAnchor="middle" fill="currentColor" opacity={0.5} fontSize={8}>
                      {data[i].label}
                    </text>
                  ))}
                </svg>
              )
            })()}

            {/* 테이블 헤더 */}
            <div className="flex items-center gap-x-2 text-[9px] text-muted-foreground font-medium pb-1 border-b border-border/50">
              <span className="w-7 shrink-0">일자</span>
              <span className="w-12 shrink-0 text-right hidden sm:block">날짜</span>
              <span className="flex-[4] text-right">종가</span>
              <span className="flex-[3] text-right">등락률</span>
              <span className="flex-[3] text-right">거래대금</span>
              <span className="flex-[2] text-right">거래량</span>
            </div>

            {/* 가격 이력 */}
            <div className="space-y-0">
              {reversed.map((c, idx) => {
                const isToday = idx === reversed.length - 1
                const label = isToday ? "D" : `D-${reversed.length - 1 - idx}`
                const rate = isToday ? currentChangeRate : c.change_rate
                const close = isToday ? currentPrice : (c.close || 0)

                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-x-2 py-1.5 text-[10px]",
                      isToday && "bg-muted/40 -mx-1 px-1 rounded font-medium",
                      idx < reversed.length - 1 && "border-b border-border/20"
                    )}
                  >
                    <span className="w-7 shrink-0 text-muted-foreground font-semibold tabular-nums">{label}</span>
                    <span className="w-12 shrink-0 text-right text-muted-foreground/50 tabular-nums hidden sm:block">{c.date.slice(5)}</span>
                    <span className="flex-[4] text-right font-bold tabular-nums">
                      {close > 0 ? formatPrice(close) : "-"}
                      <span className="text-muted-foreground/50 text-[9px] ml-0.5">원</span>
                    </span>
                    <span className="flex-[3] text-right">
                      <span className={cn(
                        "inline-block font-bold tabular-nums px-1 py-0.5 rounded",
                        getChangeBgColor(rate)
                      )}>
                        {rate > 0 ? "+" : ""}{rate.toFixed(1)}%
                      </span>
                    </span>
                    <span className="flex-[3] text-right tabular-nums text-muted-foreground">
                      {c.trading_value != null && c.trading_value > 0 ? formatTradingValue(c.trading_value) : "-"}
                    </span>
                    <span className="flex-[2] text-right tabular-nums text-muted-foreground">
                      {c.volume != null && c.volume > 0 ? formatVolume(c.volume) : "-"}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* === 장중 탭 === */}
        {activeTab === "intraday" && hasIntraday && (
          <>
            {/* 날짜 선택 + 간격 선택 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedDayIdx(Math.min(selectedDayIdx + 1, intradayDays.length - 1))}
                  disabled={selectedDayIdx >= intradayDays.length - 1}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-medium tabular-nums min-w-[130px] text-center">
                  {selectedDay ? formatDate(selectedDay.date) : "-"}
                </span>
                <button
                  onClick={() => setSelectedDayIdx(Math.max(selectedDayIdx - 1, 0))}
                  disabled={selectedDayIdx <= 0}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setInterval("30m")}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
                    interval === "30m" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  30분
                </button>
                <button
                  onClick={() => setInterval("60m")}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
                    interval === "60m" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  1시간
                </button>
              </div>
            </div>

            {/* 시가 표시 */}
            {selectedDay && (
              <div className="text-[10px] text-muted-foreground mb-1">
                시가: <span className="font-semibold text-foreground">{formatPrice(selectedDay.open)}</span>원
              </div>
            )}

            {/* 장중 종가 꺾은선 그래프 */}
            {(() => {
              if (!selectedDay || intervals.length < 2) return null
              const closes = intervals.map(item => item.close)
              const times = intervals.map(item => item.time)
              const openPrice = selectedDay.open
              const allVals = [...closes, openPrice]
              const minV = Math.min(...allVals)
              const maxV = Math.max(...allVals)
              const pts = pointCoords(closes, minV, maxV)
              const zeroY = PAD.top + PH - ((openPrice - minV) / ((maxV - minV) || 1)) * PH
              const lastUp = closes[closes.length - 1] >= openPrice
              const color = lastUp ? "#ef4444" : "#3b82f6"
              const xLabels = [0, Math.floor((closes.length - 1) / 2), closes.length - 1]
              return (
                <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full mb-2" style={{ height: 140 }}>
                  {/* Y축 라벨 */}
                  <text x={PAD.left - 4} y={PAD.top + 3} textAnchor="end" fill="currentColor" opacity={0.5} fontSize={9}>
                    {formatPrice(maxV)}
                  </text>
                  <text x={PAD.left - 4} y={CH - PAD.bottom + 3} textAnchor="end" fill="currentColor" opacity={0.5} fontSize={9}>
                    {formatPrice(minV)}
                  </text>
                  {/* 0선 (시가 기준) */}
                  <line x1={PAD.left} y1={zeroY} x2={CW - PAD.right} y2={zeroY}
                    stroke="currentColor" strokeWidth={0.5} strokeDasharray="4,3" opacity={0.4} />
                  <text x={PAD.left - 4} y={zeroY + 3} textAnchor="end" fill="currentColor" opacity={0.4} fontSize={7}>0%</text>
                  {/* 선 */}
                  <polyline points={buildPoints(closes, minV, maxV)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  {/* 포인트 */}
                  {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={2} fill={color} />
                  ))}
                  {/* X축 라벨 */}
                  {xLabels.map(i => (
                    <text key={i} x={PAD.left + (i / Math.max(closes.length - 1, 1)) * PW} y={CH - 4} textAnchor="middle" fill="currentColor" opacity={0.5} fontSize={8}>
                      {times[i]}
                    </text>
                  ))}
                </svg>
              )
            })()}

            {/* 테이블 헤더 */}
            <div className="flex items-center gap-x-2 text-[9px] text-muted-foreground font-medium pb-1 border-b border-border/50">
              <span className="w-10 shrink-0">시간</span>
              <span className="flex-[4] text-right">종가</span>
              <span className="flex-[3] text-right">등락률</span>
              <span className="flex-[3] text-right">거래량</span>
            </div>

            {/* 장중 데이터 (시간 역순) */}
            <div className="space-y-0">
              {intervals.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-6">데이터 없음</div>
              )}
              {[...intervals].reverse().map((item, idx) => (
                <div
                  key={item.time}
                  className={cn(
                    "flex items-center gap-x-2 py-1.5 text-[10px]",
                    idx === 0 && "bg-muted/40 -mx-1 px-1 rounded font-medium",
                    idx > 0 && "border-b border-border/20"
                  )}
                >
                  <span className="w-10 shrink-0 text-muted-foreground font-semibold tabular-nums">{item.time}</span>
                  <span className="flex-[4] text-right font-bold tabular-nums">
                    {formatPrice(item.close)}
                    <span className="text-muted-foreground/50 text-[9px] ml-0.5">원</span>
                  </span>
                  <span className="flex-[3] text-right">
                    <span className={cn(
                      "inline-block font-bold tabular-nums px-1 py-0.5 rounded",
                      getChangeBgColor(item.change_rate)
                    )}>
                      {item.change_rate > 0 ? "+" : ""}{item.change_rate.toFixed(2)}%
                    </span>
                  </span>
                  <span className="flex-[3] text-right tabular-nums text-muted-foreground">
                    {formatVolume(item.volume)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
