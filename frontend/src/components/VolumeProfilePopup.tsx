import { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { X } from "lucide-react"
import { cn, formatPrice } from "@/lib/utils"
import type { StockVolumeProfile, VolumeProfilePeriod, VolumeProfile } from "@/types/stock"

interface VolumeProfilePopupProps {
  stockName: string
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

const CHART_W = 300
const CHART_H = 220
const PAD = { top: 8, right: 50, bottom: 8, left: 55 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const PLOT_H = CHART_H - PAD.top - PAD.bottom

function formatVol(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M"
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "K"
  return String(v)
}

function VolumeChart({ profile, currentPrice }: { profile: VolumeProfile; currentPrice: number }) {
  const { bins, poc_price } = profile
  const maxVol = Math.max(...bins.map(b => b.volume), 1)
  const barCount = bins.length
  const barH = Math.max(PLOT_H / barCount - 1, 2)
  const gap = (PLOT_H - barH * barCount) / Math.max(barCount - 1, 1)

  // 현재가가 어느 bin에 속하는지
  const currentBinIdx = bins.findIndex(b => {
    const half = profile.bin_size / 2
    return currentPrice >= b.price - half && currentPrice < b.price + half
  })

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto">
      {/* Y축 가격 라벨 (좌측) */}
      {bins.filter((_, i) => i % Math.max(Math.floor(barCount / 5), 1) === 0 || i === barCount - 1).map((b, i) => {
        const idx = bins.indexOf(b)
        const y = PAD.top + idx * (barH + gap) + barH / 2
        return (
          <text key={i} x={PAD.left - 3} y={y + 3} textAnchor="end" fontSize={8} fill="currentColor" opacity={0.5}>
            {formatPrice(b.price)}
          </text>
        )
      })}
      {/* X축 거래량 라벨 (우측) */}
      {[0, 0.5, 1].map(r => {
        const x = PAD.left + r * PLOT_W
        const val = maxVol * r
        return (
          <text key={r} x={x} y={CHART_H - 1} textAnchor="middle" fontSize={7} fill="currentColor" opacity={0.4}>
            {formatVol(val)}
          </text>
        )
      })}
      {/* 바 차트 */}
      {bins.map((b, i) => {
        const y = PAD.top + i * (barH + gap)
        const w = (b.volume / maxVol) * PLOT_W
        const isPoc = b.price === poc_price
        const isCurrent = i === currentBinIdx
        return (
          <g key={i}>
            <rect
              x={PAD.left}
              y={y}
              width={Math.max(w, 1)}
              height={barH}
              rx={1}
              className={cn(
                isPoc ? "fill-amber-500/70" : "fill-primary/30"
              )}
            />
            {/* POC 라벨 */}
            {isPoc && (
              <text x={PAD.left + w + 3} y={y + barH / 2 + 3} fontSize={8} className="fill-amber-600 font-medium">
                POC
              </text>
            )}
            {/* 현재가 마커 */}
            {isCurrent && (
              <line
                x1={PAD.left} y1={y + barH / 2}
                x2={PAD.left + PLOT_W} y2={y + barH / 2}
                stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4,2"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function VolumeProfilePopup({ stockName, stockPrice, volumeProfile, onClose }: VolumeProfilePopupProps) {
  const { handleRef, sheetRef } = useSwipeToDismiss(onClose)

  const availablePeriods = useMemo(
    () => PERIODS.filter(p => volumeProfile[p.key]),
    [volumeProfile]
  )

  const [activePeriod, setActivePeriod] = useState<VolumeProfilePeriod>(() => {
    // 기본값: 3m, 없으면 첫 번째 가용 기간
    if (volumeProfile["3m"]) return "3m"
    return availablePeriods[0]?.key ?? "3m"
  })

  const activeProfile = volumeProfile[activePeriod]

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
              매물대{activeProfile ? ` (${activeProfile.candle_count}봉)` : ""}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 기간 탭 */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {availablePeriods.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActivePeriod(key)}
              className={cn(
                "px-3 py-1 text-[11px] font-medium rounded-md transition-colors",
                activePeriod === key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 차트 */}
        {activeProfile ? (
          <>
            <VolumeChart profile={activeProfile} currentPrice={stockPrice} />

            {/* 요약 정보 */}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/70" />
                <span>POC {formatPrice(activeProfile.poc_price)}원</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-4 border-t-2 border-dashed border-blue-500" />
                <span>현재가 {formatPrice(stockPrice)}원</span>
              </div>
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
