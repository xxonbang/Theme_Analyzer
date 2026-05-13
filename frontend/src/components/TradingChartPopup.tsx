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

  // 막대+누적 라인 미니 차트 (일별·장중 공통)
  const renderMiniBarChart = (
    vals: number[],
    color: string,
    axisLabel: string,
    fmt: (v: number) => string,
    labels: string[],
    xLabelFilter: (label: string, i: number) => boolean
  ) => {
    const W = 340
    const BH = 150
    const BPAD = { top: 28, right: 36, bottom: 26, left: 32 }
    const BPW = W - BPAD.left - BPAD.right
    const BPH = BH - BPAD.top - BPAD.bottom
    const n = vals.length
    const barW = Math.min((BPW / Math.max(n, 1)) * 0.55, 14)
    const innerLeft = BPAD.left + barW / 2
    const innerW = BPW - barW
    const slotX = (i: number) => innerLeft + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2)
    const maxV = Math.max(...vals, 1)
    const xLabelIdxs: number[] = []
    labels.forEach((l, i) => { if (xLabelFilter(l, i)) xLabelIdxs.push(i) })

    const cum: number[] = []
    let acc = 0
    for (const v of vals) { acc += v; cum.push(acc) }
    const cumMax = acc || 1
    const cumPts = cum.map((v, i) => ({ x: slotX(i), y: BPAD.top + BPH - (v / cumMax) * BPH }))

    const buildSmoothPath = (pts: { x: number; y: number }[]) => {
      if (pts.length < 2) return ""
      let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1]
        const p1 = pts[i]
        const cpX = (p0.x + p1.x) / 2
        d += ` C ${cpX.toFixed(2)},${p0.y.toFixed(2)} ${cpX.toFixed(2)},${p1.y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`
      }
      return d
    }
    const linePath = buildSmoothPath(cumPts)
    const areaPath = cumPts.length >= 2
      ? `${linePath} L ${cumPts[cumPts.length - 1].x.toFixed(2)},${(BPAD.top + BPH).toFixed(2)} L ${cumPts[0].x.toFixed(2)},${(BPAD.top + BPH).toFixed(2)} Z`
      : ""
    const barGradId = `bg-${color.replace("#", "")}`
    const areaGradId = `ag-${color.replace("#", "")}`

    return (
      <svg viewBox={`0 0 ${W} ${BH}`} className="w-full h-auto mb-5">
        <defs>
          <linearGradient id={barGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.92} />
            <stop offset="100%" stopColor={color} stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* 좌측 axisLabel + 우측 누적 */}
        <text x={4} y={14} fontSize={11} fill={color} fontWeight={600} style={{ letterSpacing: "0.02em" }}>{axisLabel}</text>
        <text x={W - BPAD.right + 4} y={14} textAnchor="start" fontSize={11} fill={color} fontWeight={600} opacity={0.85} style={{ letterSpacing: "0.02em" }}>누적</text>
        {/* 가로 그리드 + 이중 Y라벨 */}
        {[0.25, 0.5, 0.75, 1].map(r => {
          const y = BPAD.top + (1 - r) * BPH
          return (
            <g key={r}>
              <line x1={BPAD.left} y1={y} x2={W - BPAD.right} y2={y} stroke="currentColor" strokeWidth={0.5} opacity={0.16} strokeDasharray="2 3" />
              <text x={BPAD.left - 4} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="currentColor" opacity={0.7}>{fmt(maxV * r)}</text>
              <text x={W - BPAD.right + 4} y={y} textAnchor="start" dominantBaseline="middle" fontSize={9} fill={color} opacity={0.7}>{fmt(cumMax * r)}</text>
            </g>
          )
        })}
        {/* 세로 그리드 */}
        {xLabelIdxs.map(i => (
          <line key={`vg-${i}`} x1={slotX(i)} y1={BPAD.top} x2={slotX(i)} y2={BPAD.top + BPH} stroke="currentColor" strokeWidth={0.5} opacity={0.16} strokeDasharray="2 3" />
        ))}
        {/* 경계선 */}
        <line x1={BPAD.left} y1={BPAD.top} x2={BPAD.left} y2={BPAD.top + BPH} stroke="currentColor" strokeWidth={0.6} opacity={0.22} />
        <line x1={W - BPAD.right} y1={BPAD.top} x2={W - BPAD.right} y2={BPAD.top + BPH} stroke="currentColor" strokeWidth={0.6} opacity={0.22} />
        <line x1={BPAD.left} y1={BPAD.top + BPH} x2={W - BPAD.right} y2={BPAD.top + BPH} stroke="currentColor" strokeWidth={0.6} opacity={0.22} />
        {/* 막대 */}
        {vals.map((v, i) => {
          const cx = slotX(i)
          const h = maxV > 0 ? (v / maxV) * BPH : 0
          const y = BPAD.top + BPH - h
          return v > 0 ? <rect key={i} x={cx - barW / 2} y={y} width={barW} height={h} fill={`url(#${barGradId})`} rx={2.5} /> : null
        })}
        {/* 누적 area + smooth bezier 라인 */}
        {areaPath && <path d={areaPath} fill={`url(#${areaGradId})`} />}
        {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} strokeLinecap="round" strokeLinejoin="round" />}
        {cumPts.length > 0 && (() => {
          const last = cumPts[cumPts.length - 1]
          return <circle cx={last.x} cy={last.y} r={2.5} fill={color} opacity={0.85} />
        })()}
        {/* X축 라벨 */}
        {xLabelIdxs.map(i => (
          <text key={i} x={slotX(i)} y={BH - 8} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.5} style={{ letterSpacing: "0.04em" }}>{labels[i]}</text>
        ))}
      </svg>
    )
  }

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
            <div className="text-xs text-muted-foreground mb-3">거래 추이 ({reversed.length}일)</div>
            {/* 단일 차트: 거래량 막대(우측 Y) + 거래대금 꺾은선(좌측 Y) */}
            {(() => {
              const W = 340
              const BH = 150
              const BPAD = { top: 28, right: 36, bottom: 26, left: 32 }
              const BPW = W - BPAD.left - BPAD.right
              const BPH = BH - BPAD.top - BPAD.bottom
              const n = labels.length
              const barW = Math.min((BPW / Math.max(n, 1)) * 0.55, 14)
              const innerLeft = BPAD.left + barW / 2
              const innerW = BPW - barW
              const slotX = (i: number) => innerLeft + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2)
              const xLabelIdxs: number[] = []
              labels.forEach((_, i) => { if (i % 2 === 0 || i === n - 1) xLabelIdxs.push(i) })
              const volMax = Math.max(...volumes, 1)
              const tvMax = Math.max(...tradingValues, 1)
              const tvMin = Math.min(...tradingValues)
              const tvRange = tvMax - tvMin || 1
              // 라인 Y 좌표 (거래대금 — 좌측 Y축 스케일)
              const linePts = tradingValues.map((v, i) => ({
                x: slotX(i),
                y: BPAD.top + BPH - ((v - tvMin) / tvRange) * BPH * 0.92,
              }))
              const buildSmoothPath = (pts: { x: number; y: number }[]) => {
                if (pts.length < 2) return ""
                let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
                for (let i = 1; i < pts.length; i++) {
                  const p0 = pts[i - 1]
                  const p1 = pts[i]
                  const cpX = (p0.x + p1.x) / 2
                  d += ` C ${cpX.toFixed(2)},${p0.y.toFixed(2)} ${cpX.toFixed(2)},${p1.y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`
                }
                return d
              }
              const tvColor = "#e11d48"
              const volColor = "#6366f1"
              const linePath = buildSmoothPath(linePts)
              const areaPath = linePts.length >= 2
                ? `${linePath} L ${linePts[linePts.length - 1].x.toFixed(2)},${(BPAD.top + BPH).toFixed(2)} L ${linePts[0].x.toFixed(2)},${(BPAD.top + BPH).toFixed(2)} Z`
                : ""
              const barGradId = "bg-vol-daily"
              const areaGradId = "ag-tv-daily"
              return (
                <svg viewBox={`0 0 ${W} ${BH}`} className="w-full h-auto mb-5">
                  <defs>
                    <linearGradient id={barGradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={volColor} stopOpacity={0.92} />
                      <stop offset="100%" stopColor={volColor} stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={tvColor} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={tvColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {/* 좌측 axisLabel (거래대금) + 우측 axisLabel (거래량) */}
                  <text x={4} y={14} fontSize={11} fill={tvColor} fontWeight={600} style={{ letterSpacing: "0.02em" }}>거래대금</text>
                  <text x={W - BPAD.right + 4} y={14} textAnchor="start" fontSize={11} fill={volColor} fontWeight={600} style={{ letterSpacing: "0.02em" }}>거래량</text>
                  {/* 가로 그리드 + 이중 Y라벨 (좌: 거래대금, 우: 거래량) */}
                  {[0.25, 0.5, 0.75, 1].map(r => {
                    const y = BPAD.top + (1 - r) * BPH
                    const vTv = tvMin + tvRange * r
                    const vVol = volMax * r
                    return (
                      <g key={r}>
                        <line x1={BPAD.left} y1={y} x2={W - BPAD.right} y2={y} stroke="currentColor" strokeWidth={0.5} opacity={0.16} strokeDasharray="2 3" />
                        <text x={BPAD.left - 4} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill={tvColor} opacity={0.7}>{formatTradingValue(vTv)}</text>
                        <text x={W - BPAD.right + 4} y={y} textAnchor="start" dominantBaseline="middle" fontSize={9} fill={volColor} opacity={0.7}>{formatVolume(vVol)}</text>
                      </g>
                    )
                  })}
                  {/* 세로 그리드 */}
                  {xLabelIdxs.map(i => (
                    <line key={`vg-${i}`} x1={slotX(i)} y1={BPAD.top} x2={slotX(i)} y2={BPAD.top + BPH} stroke="currentColor" strokeWidth={0.5} opacity={0.16} strokeDasharray="2 3" />
                  ))}
                  {/* 경계선 */}
                  <line x1={BPAD.left} y1={BPAD.top} x2={BPAD.left} y2={BPAD.top + BPH} stroke="currentColor" strokeWidth={0.6} opacity={0.22} />
                  <line x1={W - BPAD.right} y1={BPAD.top} x2={W - BPAD.right} y2={BPAD.top + BPH} stroke="currentColor" strokeWidth={0.6} opacity={0.22} />
                  <line x1={BPAD.left} y1={BPAD.top + BPH} x2={W - BPAD.right} y2={BPAD.top + BPH} stroke="currentColor" strokeWidth={0.6} opacity={0.22} />
                  {/* 거래량 막대 */}
                  {volumes.map((v, i) => {
                    const cx = slotX(i)
                    const h = volMax > 0 ? (v / volMax) * BPH : 0
                    const y = BPAD.top + BPH - h
                    return v > 0 ? <rect key={i} x={cx - barW / 2} y={y} width={barW} height={h} fill={`url(#${barGradId})`} rx={2.5} /> : null
                  })}
                  {/* 거래대금 area + 꺾은선 */}
                  {areaPath && <path d={areaPath} fill={`url(#${areaGradId})`} />}
                  {linePath && <path d={linePath} fill="none" stroke={tvColor} strokeWidth={1.8} opacity={0.85} strokeLinecap="round" strokeLinejoin="round" />}
                  {linePts.map((p, i) => (
                    <circle key={`p-${i}`} cx={p.x} cy={p.y} r={2} fill={tvColor} opacity={0.85} />
                  ))}
                  {/* X축 라벨 */}
                  {xLabelIdxs.map(i => (
                    <text key={i} x={slotX(i)} y={BH - 8} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.55} style={{ letterSpacing: "0.04em" }}>{labels[i]}</text>
                  ))}
                </svg>
              )
            })()}

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
                {/* mini bar chart × 2 — 그라데이션 막대 + smooth bezier 누적 라인 */}
                {(() => {
                  const tvVals = intradaySlots.map(s => s.trading_value ?? 0)
                  const volVals = intradaySlots.map(s => s.volume ?? 0)
                  const labels = intradaySlots.map(s => s.time)
                  const xFilter = (t: string) => t.endsWith(":00")
                  return (
                    <>
                      {renderMiniBarChart(tvVals, "#e11d48", "거래대금", formatTradingValue, labels, xFilter)}
                      {renderMiniBarChart(volVals, "#6366f1", "거래량", formatVolume, labels, xFilter)}
                    </>
                  )
                })()}
                {/* 표 (좌우 여백 추가) */}
                <div className="space-y-0 mt-2 px-3">
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
