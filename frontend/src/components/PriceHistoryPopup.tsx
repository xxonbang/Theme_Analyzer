import { useState } from "react"
import { createPortal } from "react-dom"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { useScrollLock } from "@/hooks/useScrollLock"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { cn, formatPrice, formatVolume, formatTradingValue, getChangeBgColor } from "@/lib/utils"
import { isHistoryStale } from "@/lib/market-metrics"
import type { HistoryChange, IntradayDay } from "@/types/stock"

// 차트 상수
const CW = 360
const CH = 150
const PAD = { top: 14, right: 34, bottom: 24, left: 30 }
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

  // stock-history changes의 최신 날짜가 5영업일 이상 옛날이면 stale.
  // stale인 경우 D를 합치면 시점 격차로 등락률 표시 오류 발생 → 안내 + D 등락률 재계산.
  const latestChangeDate = changes[0]?.date
  const stale = isHistoryStale(latestChangeDate)
  // stale 시 D 등락률을 stock-history.changes[0]와의 비율로 재계산 (정직한 큰 값 표시)
  const dRate = stale && changes[0]?.close
    ? ((currentPrice - changes[0].close) / changes[0].close) * 100
    : currentChangeRate

  // 탭 상태: 거래일 장중(09:00~15:30) + intraday 데이터 있으면 장중 탭 기본
  const hasIntraday = intradayDays && intradayDays.length > 0
  const isMarketHours = (() => {
    const now = new Date()
    const day = now.getDay()
    // 주말 제외
    if (day === 0 || day === 6) return false
    // 한국 공휴일 (양력 고정 + 당해 음력 연휴)
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    const dd = String(now.getDate()).padStart(2, "0")
    const mmdd = `${mm}-${dd}`
    const y = now.getFullYear()
    const holidays = [
      "01-01", "03-01", "05-05", "06-06", "08-15", "10-03", "10-09", "12-25",
      // 2026년 설날·추석·대체공휴일 등 (매년 갱신 필요)
      ...(y === 2026 ? ["01-28", "01-29", "01-30", "02-17", "02-18", "02-19", "05-24", "05-25", "05-26", "10-04", "10-05", "10-06"] : []),
    ]
    if (holidays.includes(mmdd)) return false
    const h = now.getHours(), m = now.getMinutes()
    const t = h * 60 + m
    return t >= 9 * 60 && t <= 15 * 60 + 30
  })()
  const [activeTab, setActiveTab] = useState<"daily" | "intraday">(hasIntraday && isMarketHours ? "intraday" : "daily")
  const [interval, setInterval] = useState<"30m" | "60m">("30m")
  // 오늘 날짜(KST) 기준 초기 선택
  const todayKST = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })()
  const todayInArray = hasIntraday ? intradayDays.findIndex(d => d.date === todayKST) : -1
  const [selectedDayIdx, setSelectedDayIdx] = useState(todayInArray >= 0 ? todayInArray : -1)

  useScrollLock(true)

  // 장중 선택된 날짜 데이터 — 오늘이면 현재 시각까지만 표시
  const selectedDay = hasIntraday && selectedDayIdx >= 0 ? intradayDays[selectedDayIdx] : null
  const intervals = (() => {
    if (!selectedDay) return []
    const raw = interval === "30m" ? selectedDay.intervals_30m : selectedDay.intervals_60m
    if (selectedDay.date !== todayKST) return raw
    // 오늘: 현재 시각(HH:MM) 이전 봉만
    const now = new Date()
    const nowHHMM = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`
    return raw.filter(item => item.time <= nowHHMM)
  })()

  // 날짜 포맷 (2026-03-09 → 2026.03.09)
  const formatDate = (date: string) => {
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
    const d = new Date(date)
    const day = weekdays[d.getDay()]
    return `${date.replace(/-/g, ".")} (${day})`
  }

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />

      <div ref={sheetRef} className="relative w-full sm:w-[28rem] sm:max-w-[90vw] max-h-[85vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
        {/* 모바일 드래그 핸들 + 닫기 */}
        <div ref={handleRef} className="sm:hidden flex items-center justify-center mb-2 py-1 cursor-grab relative sticky top-0 bg-popover z-10">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
          <button onClick={onClose} className="absolute right-0 text-muted-foreground hover:text-foreground p-1" aria-label="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm font-semibold">{stockName}</span>
            {activeTab === "daily" && (
              <span className="text-xs text-muted-foreground ml-2">최근 {reversed.length}일 변동</span>
            )}
          </div>
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
            {stale && (
              <div className="mb-2 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/5 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                ⚠ <strong>이력 데이터가 오래되었습니다 (마지막: {latestChangeDate ?? "?"}).</strong> D 등락률은 마지막 이력일 종가와 비교한 값으로 큰 값이 나올 수 있습니다.
              </div>
            )}
            {/* 종가 라인 + 거래량 막대 그래프 */}
            {(() => {
              const data = reversed.map((c, idx) => ({
                close: idx === reversed.length - 1 ? currentPrice : (c.close || 0),
                rate: idx === reversed.length - 1 ? dRate : c.change_rate,
                volume: c.volume || 0,
                label: idx === reversed.length - 1 ? "D" : `D-${reversed.length - 1 - idx}`,
              })).filter(d => d.close > 0)
              if (data.length < 2) return null
              const closes = data.map(d => d.close)
              const rates = data.map(d => d.rate)
              const volumes = data.map(d => d.volume)
              const up = closes[closes.length - 1] >= closes[0]
              const lineColor = up ? "#ef4444" : "#3b82f6"
              const baseClose = closes[0]

              // Y축 범위: 종가 범위와 등락률 환산 가격 범위를 모두 포함
              const ratePrices = rates.map(r => baseClose * (1 + r / 100))
              const minV = Math.min(...closes, ...ratePrices)
              const maxV = Math.max(...closes, ...ratePrices)
              const pts = pointCoords(closes, minV, maxV)

              // 등락률 포인트: 좌측 Y축(D-10 기준 %)과 동일 스케일
              const priceRange = (maxV - minV) || 1
              const ratePoints = ratePrices.map((rp, i) => {
                const x = PAD.left + (i / Math.max(ratePrices.length - 1, 1)) * PW
                const y = PAD.top + PH - ((rp - minV) / priceRange) * PH
                return `${x},${y}`
              }).join(" ")

              // 거래량 스케일 (차트 하단 40% 영역 사용)
              const volMax = Math.max(...volumes, 1)
              const volAreaH = PH * 0.4
              const barW = Math.min(PW / data.length * 0.5, 12)

              // Y축: 5단계 균등 분할
              const ySteps = 4
              const yTicks = Array.from({ length: ySteps + 1 }, (_, i) => minV + (maxV - minV) * (i / ySteps))
              return (<>
                <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full mb-2" style={{ height: 140 }}>
                  {/* 가로 그리드라인 + 왼쪽 Y축(등락률) + 오른쪽 Y축(가격) */}
                  {yTicks.map((v, i) => {
                    const y = PAD.top + PH - ((v - minV) / ((maxV - minV) || 1)) * PH
                    const rate = baseClose ? ((v - baseClose) / baseClose) * 100 : 0
                    return (
                      <g key={`yg-${i}`}>
                        <line x1={PAD.left} y1={y} x2={CW - PAD.right} y2={y}
                          stroke="currentColor" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.15} />
                        <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="currentColor" opacity={0.5} fontSize={9}>
                          {rate > 0 ? "+" : ""}{rate.toFixed(1)}%
                        </text>
                        <text x={CW - PAD.right + 4} y={y + 3} textAnchor="start" fill="currentColor" opacity={0.4} fontSize={8}>
                          {formatPrice(Math.round(v))}
                        </text>
                      </g>
                    )
                  })}
                  {/* 거래량 막대 (하단 정렬, 등락 방향 색상, 양 끝 인셋) */}
                  {data.map((d, i) => {
                    const barInset = barW * 0.7
                    const barPlotW = PW - barInset * 2
                    const x = PAD.left + barInset + (i / Math.max(data.length - 1, 1)) * barPlotW
                    const barH = (d.volume / volMax) * volAreaH
                    const barY = PAD.top + PH - barH
                    const barColor = d.rate >= 0 ? "#ef4444" : "#3b82f6"
                    return (
                      <rect key={`bar-${i}`} x={x - barW / 2} y={barY} width={barW} height={Math.max(barH, 0.5)}
                        fill={barColor} opacity={0.2} rx={1} />
                    )
                  })}
                  {/* 세로 그리드라인 (거래량 막대 위에 렌더링) */}
                  {data.map((_, i) => {
                    const x = Math.round(PAD.left + (i / Math.max(data.length - 1, 1)) * PW) + 0.5
                    return (
                      <line key={`xg-${i}`} x1={x} y1={PAD.top} x2={x} y2={CH - PAD.bottom}
                        stroke="currentColor" strokeWidth={1} strokeDasharray="3,3" opacity={0.12} shapeRendering="crispEdges" />
                    )
                  })}
                  {/* 등락률 점선 */}
                  <polyline points={ratePoints} fill="none" stroke="#f59e0b" strokeWidth={1.2} strokeDasharray="4,3" strokeLinecap="round" strokeLinejoin="round" opacity={0.45} />
                  {/* 종가 선 */}
                  <polyline points={buildPoints(closes, minV, maxV)} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  {/* 포인트 */}
                  {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={lineColor} />
                  ))}
                  {/* X축 라벨 */}
                  {data.map((d, i) => (
                    <text key={i} x={PAD.left + (i / Math.max(data.length - 1, 1)) * PW} y={CH - 4} textAnchor="middle" fill="currentColor" opacity={0.5} fontSize={7}>
                      {d.label}
                    </text>
                  ))}
                </svg>

                {/* 범례 */}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: lineColor }} />종가</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded inline-block border-t-[1.5px] border-dashed border-amber-500/50" />등락률</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-500/20 rounded-sm inline-block" />거래량(상승)</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-500/20 rounded-sm inline-block" />거래량(하락)</span>
                </div>
              </>)
            })()}

            {/* 테이블 헤더 */}
            <div className="flex items-center gap-x-2 text-[10px] text-muted-foreground font-medium pb-1 border-b border-border/50">
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
                const rate = isToday ? dRate : c.change_rate
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
                      <span className="text-muted-foreground/50 text-[10px] ml-0.5">원</span>
                    </span>
                    <span className="flex-[3] text-right">
                      <span className={cn(
                        "inline-block font-bold tabular-nums px-1 py-0.5 rounded",
                        getChangeBgColor(rate)
                      )}>
                        {rate > 0 ? "+" : ""}{rate.toFixed(2)}%
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
                  onClick={() => {
                    if (selectedDayIdx === -1) setSelectedDayIdx(0)
                    else setSelectedDayIdx(Math.min(selectedDayIdx + 1, intradayDays.length - 1))
                  }}
                  disabled={selectedDayIdx >= intradayDays.length - 1}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-medium tabular-nums min-w-[130px] text-center">
                  {selectedDay ? formatDate(selectedDay.date) : formatDate(todayKST)}
                  {(selectedDay ? selectedDay.date : todayKST) === todayKST && (
                    <span className="ml-1 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">오늘</span>
                  )}
                </span>
                <button
                  onClick={() => {
                    if (selectedDayIdx === 0 && todayInArray < 0) setSelectedDayIdx(-1)
                    else setSelectedDayIdx(Math.max(selectedDayIdx - 1, 0))
                  }}
                  disabled={selectedDayIdx === -1}
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

            {/* 시가/전일종가 표시 */}
            {selectedDay && (
              <div className="text-[10px] text-muted-foreground mb-1 flex gap-3">
                <span>시가: <span className="font-semibold text-foreground">{formatPrice(selectedDay.open)}</span>원</span>
                {selectedDay.prev_close > 0 && (
                  <span>전일종가: <span className="font-semibold text-foreground">{formatPrice(selectedDay.prev_close)}</span>원</span>
                )}
              </div>
            )}

            {/* 장중 종가 꺾은선 그래프 (변동폭 정보는 표 H/L에서 제공) */}
            {(() => {
              if (!selectedDay || intervals.length < 2) return null
              const closes = intervals.map(item => item.close)
              const times = intervals.map(item => item.time)
              const basePrice = selectedDay.prev_close > 0 ? selectedDay.prev_close : selectedDay.open

              // close 변동만으로 Y축 산정 — close 변동이 차트 약 70% 영역에 펼쳐짐
              // (basePrice를 강제 포함하면 한쪽으로 치우친 날 차트 절반이 비고 변동 압축됨)
              const closeOnlyMin = Math.min(...closes)
              const closeOnlyMax = Math.max(...closes)
              const closeSpread = closeOnlyMax - closeOnlyMin
              // 변동 작은 날(±0.5% 미만)도 적정 펼침: 최소 basePrice의 0.5% 보장
              const effectiveSpread = Math.max(closeSpread, basePrice * 0.005)
              const padding = effectiveSpread * 0.2
              const minV = closeOnlyMin - padding
              const maxV = closeOnlyMax + padding
              const range = (maxV - minV) || 1
              const yOf = (v: number) => PAD.top + PH - ((v - minV) / range) * PH
              const zeroY = yOf(basePrice)
              const baseInChart = basePrice >= minV && basePrice <= maxV

              const pts = pointCoords(closes, minV, maxV)
              const lastUp = closes[closes.length - 1] >= basePrice
              const color = lastUp ? "#ef4444" : "#3b82f6"

              // X축: 정시(":00") 라벨만 표시 + 첫/끝 항상 표시
              const xLabelIdxs: number[] = []
              times.forEach((t, i) => {
                if (i === 0 || i === times.length - 1 || t.endsWith(":00")) xLabelIdxs.push(i)
              })

              // yTicks 자연 균등 5단계 분할 (0% anchor 강제 X)
              const ySteps = 4
              const yTicks = Array.from({ length: ySteps + 1 }, (_, i) => minV + (range / ySteps) * i)
              // 별도 0% line과 너무 가까운 yTick은 라벨 숨김 (1단계 폭의 35% 미만)
              // basePrice가 차트 밖이면 0% line 없으니 충돌 없음
              const stepPx = PH / ySteps
              const tooCloseToZero = (y: number) => baseInChart && Math.abs(y - zeroY) < stepPx * 0.35
              return (
                <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full mb-2" style={{ height: 140 }}>
                  {/* 가로 그리드라인 + 왼쪽 Y축(등락률) + 오른쪽 Y축(가격) */}
                  {yTicks.map((v, i) => {
                    const y = yOf(v)
                    if (tooCloseToZero(y)) return null
                    const rate = basePrice ? ((v - basePrice) / basePrice) * 100 : 0
                    return (
                      <g key={`yg-${i}`}>
                        <line x1={PAD.left} y1={y} x2={CW - PAD.right} y2={y}
                          stroke="currentColor" strokeWidth={0.5}
                          strokeDasharray="3,3" opacity={0.12} />
                        <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="currentColor"
                          opacity={0.55} fontSize={9}>
                          {rate > 0 ? "+" : ""}{rate.toFixed(1)}%
                        </text>
                        <text x={CW - PAD.right + 4} y={y + 3} textAnchor="start" fill="currentColor" opacity={0.4} fontSize={8}>
                          {formatPrice(Math.round(v))}
                        </text>
                      </g>
                    )
                  })}
                  {/* 0% 기준선 (basePrice) — 차트 안이면 dashed line, 밖이면 가장자리 인디케이터 */}
                  {baseInChart ? (
                    <>
                      <line x1={PAD.left} y1={zeroY} x2={CW - PAD.right} y2={zeroY}
                        stroke="currentColor" strokeWidth={0.7} strokeDasharray="4,3" opacity={0.45} />
                      <text x={PAD.left - 4} y={zeroY + 3} textAnchor="end" fill="currentColor"
                        opacity={0.65} fontSize={9} fontWeight={600}>0%</text>
                      <text x={CW - PAD.right + 4} y={zeroY + 3} textAnchor="start" fill="currentColor" opacity={0.5} fontSize={8}>
                        {formatPrice(basePrice)}
                      </text>
                    </>
                  ) : (
                    <text
                      x={PAD.left + 4}
                      y={basePrice < minV ? CH - PAD.bottom - 3 : PAD.top + 9}
                      fill="currentColor" opacity={0.55} fontSize={8} fontWeight={500}
                    >
                      {basePrice < minV ? "↓" : "↑"} 전일종가 0% ({formatPrice(basePrice)}원)
                    </text>
                  )}
                  {/* 세로 그리드라인 */}
                  {closes.map((_, i) => {
                    const x = PAD.left + (i / Math.max(closes.length - 1, 1)) * PW
                    return (
                      <line key={`xg-${i}`} x1={x} y1={PAD.top} x2={x} y2={CH - PAD.bottom}
                        stroke="currentColor" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.08} />
                    )
                  })}
                  {/* close 라인 */}
                  <polyline points={buildPoints(closes, minV, maxV)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  {/* close 포인트 */}
                  {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={2} fill={color} />
                  ))}
                  {/* X축 라벨 */}
                  {xLabelIdxs.map(i => (
                    <text key={i} x={PAD.left + (i / Math.max(closes.length - 1, 1)) * PW} y={CH - 4} textAnchor="middle" fill="currentColor" opacity={0.55} fontSize={8}>
                      {times[i]}
                    </text>
                  ))}
                </svg>
              )
            })()}

            {/* 테이블 헤더 */}
            <div className="flex items-center gap-x-2 text-[10px] text-muted-foreground font-medium pb-1 border-b border-border/50">
              <span className="w-10 shrink-0">시간</span>
              <span className="flex-[4] text-right">현재가</span>
              <span className="flex-[3] text-right">등락률</span>
              <span className="flex-[3] text-right">거래량</span>
            </div>

            {/* 장중 데이터 (시간 역순) */}
            <div className="space-y-0">
              {intervals.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-6">데이터 없음</div>
              )}
              {intervals.map((item, idx) => (
                <div
                  key={item.time}
                  className={cn(
                    "flex items-center gap-x-2 py-1.5 text-[10px]",
                    idx === 0 && "bg-muted/30 -mx-1 px-1 rounded font-medium",
                    idx > 0 && "border-b border-border/20"
                  )}
                >
                  <span className="w-10 shrink-0 text-muted-foreground font-semibold tabular-nums">{item.time}</span>
                  <span className="flex-[4] text-right">
                    <span className="block font-bold tabular-nums">
                      {formatPrice(item.close)}
                      <span className="text-muted-foreground/50 text-[10px] ml-0.5">원</span>
                    </span>
                    {(item.high !== item.low) && (() => {
                      const base = selectedDay && selectedDay.prev_close > 0 ? selectedDay.prev_close : (selectedDay?.open ?? 0)
                      const highRate = base ? ((item.high - base) / base) * 100 : 0
                      const lowRate = base ? ((item.low - base) / base) * 100 : 0
                      const fmt = (r: number) => `${r > 0 ? "+" : ""}${r.toFixed(2)}%`
                      const rateCls = (r: number) => r > 0 ? "text-rose-500/70" : r < 0 ? "text-blue-500/70" : "text-muted-foreground/60"
                      return (
                        <span className="block tabular-nums leading-tight mt-0.5">
                          <span className="block text-[10px]">
                            <span className="text-rose-500/80 font-semibold">H</span>{" "}
                            <span className="text-muted-foreground/80">{formatPrice(item.high)}</span>{" "}
                            <span className={cn("text-[9px]", rateCls(highRate))}>{fmt(highRate)}</span>
                          </span>
                          <span className="block text-[10px]">
                            <span className="text-blue-500/80 font-semibold">L</span>{" "}
                            <span className="text-muted-foreground/80">{formatPrice(item.low)}</span>{" "}
                            <span className={cn("text-[9px]", rateCls(lowRate))}>{fmt(lowRate)}</span>
                          </span>
                        </span>
                      )
                    })()}
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
