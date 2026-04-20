import { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { useScrollLock } from "@/hooks/useScrollLock"
import { X } from "lucide-react"
import { cn, formatPrice } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { StockVolumeProfile, VolumeProfilePeriod, VolumeProfileBin } from "@/types/stock"

interface VolumeProfilePopupProps {
  stockName: string
  stockCode: string
  stockPrice: number
  volumeProfile: StockVolumeProfile
  onClose: () => void
}

const PERIODS: { key: VolumeProfilePeriod; label: string }[] = [
  { key: "today", label: "당일" },
  { key: "1w", label: "1주" },
  { key: "1m", label: "1개월" },
  { key: "3m", label: "3개월" },
  { key: "6m", label: "6개월" },
  { key: "1y", label: "1년" },
]

const BIN_COUNTS = [5, 10, 20] as const
type BinCount = typeof BIN_COUNTS[number]

const CHART_W = 330
const PAD = { top: 8, right: 50, bottom: 22, left: 54 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const MAX_BAR_H = 32

function formatVol(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M"
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "K"
  return String(v)
}

/** 원본 20개 bins를 targetCount개로 병합 */
function mergeBins(originalBins: VolumeProfileBin[], targetCount: number): { bins: VolumeProfileBin[]; pocPrice: number } {
  if (targetCount >= originalBins.length) {
    const poc = originalBins.reduce((max, b) => b.volume > max.volume ? b : max, originalBins[0])
    return { bins: originalBins, pocPrice: poc.price }
  }
  const chunkSize = Math.ceil(originalBins.length / targetCount)
  const merged: VolumeProfileBin[] = []
  for (let i = 0; i < originalBins.length; i += chunkSize) {
    const chunk = originalBins.slice(i, i + chunkSize)
    const totalVol = chunk.reduce((s, b) => s + b.volume, 0)
    const weightedPrice = totalVol > 0
      ? Math.round(chunk.reduce((s, b) => s + b.price * b.volume, 0) / totalVol)
      : Math.round(chunk.reduce((s, b) => s + b.price, 0) / chunk.length)
    merged.push({ price: weightedPrice, volume: totalVol })
  }
  const poc = merged.reduce((max, b) => b.volume > max.volume ? b : max, merged[0])
  return { bins: merged, pocPrice: poc.price }
}

function VolumeChart({ bins, pocPrice, currentPrice, avgPrice, selectedIdx, onSelect }: {
  bins: VolumeProfileBin[]; pocPrice: number; currentPrice: number; avgPrice?: number | null
  selectedIdx: number | null; onSelect: (idx: number | null) => void
}) {
  const sorted = [...bins].reverse()
  const maxVol = Math.max(...sorted.map(b => b.volume), 1)
  const totalVol = sorted.reduce((sum, b) => sum + b.volume, 0) || 1
  const barCount = sorted.length
  // 동적 바 크기: 구간 수가 적을 때 차트 높이 축소
  const barH = Math.min(Math.max(350 / barCount - 1.5, 4), MAX_BAR_H)
  const gap = Math.max(Math.min(barH * 0.15, 6), 1.5)
  const plotH = barCount * barH + Math.max(barCount - 1, 0) * gap
  const chartH = plotH + PAD.top + PAD.bottom

  // 현재가 Y 좌표: 가격 스케일에서 보간, 범위 밖이면 경계에 클램핑
  const currentPriceInfo = useMemo(() => {
    if (barCount < 2) return null
    const topY = PAD.top + barH / 2
    const bottomY = PAD.top + (barCount - 1) * (barH + gap) + barH / 2
    const highPrice = sorted[0].price
    const lowPrice = sorted[barCount - 1].price
    if (highPrice <= lowPrice) return null
    const ratio = (highPrice - currentPrice) / (highPrice - lowPrice)
    const rawY = topY + ratio * (bottomY - topY)
    const y = Math.max(PAD.top - 2, Math.min(PAD.top + plotH + 2, rawY))
    return { y, isAbove: currentPrice > highPrice, isBelow: currentPrice < lowPrice }
  }, [sorted, currentPrice, barCount, barH, gap, plotH])

  // 평단가 Y 좌표
  const avgPriceInfo = useMemo(() => {
    if (!avgPrice || barCount < 2) return null
    const topY = PAD.top + barH / 2
    const bottomY = PAD.top + (barCount - 1) * (barH + gap) + barH / 2
    const highPrice = sorted[0].price
    const lowPrice = sorted[barCount - 1].price
    if (highPrice <= lowPrice) return null
    const ratio = (highPrice - avgPrice) / (highPrice - lowPrice)
    const rawY = topY + ratio * (bottomY - topY)
    const y = Math.max(PAD.top - 2, Math.min(PAD.top + plotH + 2, rawY))
    return { y, isAbove: avgPrice > highPrice, isBelow: avgPrice < lowPrice }
  }, [sorted, avgPrice, barCount, barH, gap, plotH])

  return (
    <svg viewBox={`0 0 ${CHART_W} ${chartH}`} className="w-full h-auto">
      {/* 수직 그리드 라인 */}
      {[0.25, 0.5, 0.75].map(r => (
        <line
          key={r}
          x1={PAD.left + r * PLOT_W} y1={PAD.top}
          x2={PAD.left + r * PLOT_W} y2={PAD.top + plotH}
          stroke="currentColor" strokeOpacity={0.07} strokeDasharray="2,4"
        />
      ))}
      {/* Y축 가격 라벨 — 2개 중 1개 */}
      {sorted.map((b, i) => {
        if (i % 2 !== 0 && i !== barCount - 1) return null
        const y = PAD.top + i * (barH + gap) + barH / 2
        return (
          <text key={`y-${i}`} x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize={9.5} fill="currentColor" opacity={0.5}>
            {formatPrice(b.price)}
          </text>
        )
      })}
      {/* X축 거래량 라벨 */}
      {[0, 0.5, 1].map(r => {
        const x = PAD.left + r * PLOT_W
        return (
          <text key={r} x={x} y={chartH - 4} textAnchor="middle" fontSize={8.5} fill="currentColor" opacity={0.35}>
            {formatVol(maxVol * r)}
          </text>
        )
      })}
      {/* 바 차트 */}
      {sorted.map((b, i) => {
        const y = PAD.top + i * (barH + gap)
        const w = (b.volume / maxVol) * PLOT_W
        const isPoc = b.price === pocPrice
        const isSelected = i === selectedIdx
        const pct = ((b.volume / totalVol) * 100).toFixed(1) + "%"
        return (
          <g key={i} className="cursor-pointer" onClick={() => onSelect(isSelected ? null : i)}>
            {/* 탭 히트 영역 */}
            <rect x={PAD.left} y={y - gap / 2} width={PLOT_W} height={barH + gap} fill="transparent" />
            {/* 선택 하이라이트 */}
            {isSelected && (
              <rect x={PAD.left} y={y - 1} width={PLOT_W} height={barH + 2} rx={2} fill="currentColor" opacity={0.06} />
            )}
            {/* 바 */}
            <rect
              x={PAD.left} y={y}
              width={Math.max(w, 2)} height={barH} rx={2.5}
              className={cn(
                isPoc
                  ? (isSelected ? "fill-amber-500/80" : "fill-amber-500/60")
                  : (isSelected ? "fill-primary/45" : "fill-primary/25")
              )}
            />
            {/* % 라벨 */}
            {w > 38 ? (
              <text
                x={PAD.left + w - 4} y={y + barH / 2 + 3.5}
                textAnchor="end" fontSize={9.5} fontWeight="600"
                className={isPoc ? "fill-amber-900 dark:fill-amber-200" : ""}
                fill={isPoc ? undefined : "currentColor"} opacity={isPoc ? undefined : 0.6}
              >
                {pct}
              </text>
            ) : (
              <text
                x={PAD.left + Math.max(w, 2) + 4} y={y + barH / 2 + 3.5}
                textAnchor="start" fontSize={9.5} fontWeight="600"
                fill="currentColor" opacity={0.45}
              >
                {pct}
              </text>
            )}
            {/* POC 라벨 */}
            {isPoc && (
              <text
                x={CHART_W - PAD.right + 4} y={y + barH / 2 + 3.5}
                fontSize={9} fontWeight="700" letterSpacing={0.5}
                className="fill-amber-600 dark:fill-amber-400"
              >
                POC
              </text>
            )}
          </g>
        )
      })}
      {/* 현재가 마커 — 가격 스케일 기준 보간 위치 (범위 밖이면 경계 클램핑 + 화살표) */}
      {currentPriceInfo !== null && (
        <>
          <line
            x1={PAD.left} y1={currentPriceInfo.y}
            x2={PAD.left + PLOT_W} y2={currentPriceInfo.y}
            stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4,3" strokeOpacity={0.8}
          />
          <text
            x={CHART_W - PAD.right + 4} y={currentPriceInfo.y + 3}
            fontSize={8} fontWeight="600" fill="#3b82f6" opacity={0.9}
          >
            {currentPriceInfo.isAbove ? "▲ 현재" : currentPriceInfo.isBelow ? "▼ 현재" : "현재"}
          </text>
        </>
      )}
      {/* 평단가 마커 (포트폴리오 보유 종목만) */}
      {avgPriceInfo !== null && (
        <>
          <line
            x1={PAD.left} y1={avgPriceInfo.y}
            x2={PAD.left + PLOT_W} y2={avgPriceInfo.y}
            stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,3" strokeOpacity={0.8}
          />
          <text
            x={CHART_W - PAD.right + 4} y={avgPriceInfo.y + 3}
            fontSize={8} fontWeight="600" fill="#ef4444" opacity={0.9}
          >
            {avgPriceInfo.isAbove ? "▲ 평단" : avgPriceInfo.isBelow ? "▼ 평단" : "평단"}
          </text>
        </>
      )}
    </svg>
  )
}

export function VolumeProfilePopup({ stockName, stockCode, stockPrice, volumeProfile, onClose }: VolumeProfilePopupProps) {
  const { handleRef, sheetRef } = useSwipeToDismiss(onClose)
  const { user } = useAuth()

  // 포트폴리오 보유 종목이면 평단가 조회
  const [holdingAvgPrice, setHoldingAvgPrice] = useState<number | null>(null)
  useEffect(() => {
    if (!user || !stockCode) return
    supabase
      .from("portfolio_holdings")
      .select("avg_price")
      .eq("user_id", user.id)
      .eq("code", stockCode)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.avg_price) setHoldingAvgPrice(data.avg_price)
      })
  }, [user, stockCode])

  const availablePeriods = useMemo(
    () => PERIODS.filter(p => volumeProfile[p.key]),
    [volumeProfile]
  )

  const [activePeriod, setActivePeriod] = useState<VolumeProfilePeriod>(() => {
    if (volumeProfile["3m"]) return "3m"
    return availablePeriods[0]?.key ?? "3m"
  })

  const [binCount, setBinCount] = useState<BinCount>(10)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const activeProfile = volumeProfile[activePeriod]

  const { displayBins, displayPocPrice } = useMemo(() => {
    if (!activeProfile) return { displayBins: [], displayPocPrice: 0 }
    const { bins, pocPrice } = mergeBins(activeProfile.bins, binCount)
    return { displayBins: bins, displayPocPrice: pocPrice }
  }, [activeProfile, binCount])

  useEffect(() => { setSelectedIdx(null) }, [activePeriod, binCount])

  const selectedBin = useMemo(() => {
    if (selectedIdx === null) return null
    const sorted = [...displayBins].reverse()
    return sorted[selectedIdx] ?? null
  }, [selectedIdx, displayBins])

  const totalVol = useMemo(() => displayBins.reduce((s, b) => s + b.volume, 0) || 1, [displayBins])

  const selectedPriceDiff = useMemo(() => {
    if (!selectedBin || !stockPrice) return null
    return ((selectedBin.price - stockPrice) / stockPrice) * 100
  }, [selectedBin, stockPrice])

  useScrollLock(true)

  return createPortal(
    <div className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div ref={sheetRef} className="relative w-full sm:w-[28rem] sm:max-w-[90vw] max-h-[85vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
        {/* 모바일 드래그 핸들 + 닫기 */}
        <div ref={handleRef} className="sm:hidden flex items-center justify-center mb-2 py-3 cursor-grab relative sticky top-0 bg-popover z-10">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
          <button onClick={onClose} className="absolute right-0 text-muted-foreground hover:text-foreground p-1" aria-label="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 헤더 + 구간 수 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{stockName}</span>
            <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
              매물대{activeProfile ? ` · ${activeProfile.candle_count}봉` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">구간</span>
              <div className="flex border border-border rounded-md overflow-hidden">
                {BIN_COUNTS.map((n, idx) => (
                  <button
                    key={n}
                    onClick={() => setBinCount(n)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-medium transition-colors",
                      idx < BIN_COUNTS.length - 1 && "border-r border-border",
                      binCount === n
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="hidden sm:block text-muted-foreground hover:text-foreground p-1 -m-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 기간 탭 (별도 행 — 전체 너비) */}
        <div className="flex gap-1 flex-wrap mb-3">
          {availablePeriods.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActivePeriod(key)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full transition-colors",
                activePeriod === key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 차트 */}
        {activeProfile ? (
          <>
            <div key={`${activePeriod}-${binCount}`} className="animate-tab-fade-in">
              <VolumeChart
                bins={displayBins}
                pocPrice={displayPocPrice}
                currentPrice={stockPrice}
                avgPrice={holdingAvgPrice}
                selectedIdx={selectedIdx}
                onSelect={setSelectedIdx}
              />
            </div>

            {/* 선택된 바 상세 */}
            {selectedBin && (
              <div className="flex items-center justify-between py-2 px-3 mt-2 mb-1 rounded-lg bg-muted/50 text-xs animate-tab-fade-in">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatPrice(selectedBin.price)}원</span>
                  <span className="text-muted-foreground">{formatVol(selectedBin.volume)}</span>
                  <span className="text-muted-foreground">
                    {((selectedBin.volume / totalVol) * 100).toFixed(1)}%
                  </span>
                </div>
                {selectedPriceDiff !== null && (
                  <span className={cn(
                    "font-medium tabular-nums",
                    selectedPriceDiff > 0 ? "text-red-500" : selectedPriceDiff < 0 ? "text-blue-500" : "text-muted-foreground"
                  )}>
                    {selectedPriceDiff > 0 ? "+" : ""}{selectedPriceDiff.toFixed(1)}%
                  </span>
                )}
              </div>
            )}

            {/* 범례 */}
            <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-2.5 rounded-sm bg-amber-500/60" />
                <span>POC {formatPrice(displayPocPrice)}원</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 border-t-[1.5px] border-dashed border-blue-500" />
                <span>현재가 {formatPrice(stockPrice)}원</span>
              </div>
              {holdingAvgPrice && (
                <div className="flex items-center gap-1.5">
                  <span className="w-4 border-t-[1.5px] border-dashed border-red-500" />
                  <span>평단가 {formatPrice(holdingAvgPrice)}원</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center text-xs text-muted-foreground py-8">매물대 데이터 없음</div>
        )}
      </div>
    </div>,
    document.body
  )
}
