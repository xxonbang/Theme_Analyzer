import { useEffect } from "react"
import { createPortal } from "react-dom"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { X } from "lucide-react"
import { cn, formatPrice, formatVolume, formatTradingValue, getChangeBgColor } from "@/lib/utils"
import type { HistoryChange } from "@/types/stock"

interface PriceHistoryPopupProps {
  stockName: string
  currentPrice: number
  currentChangeRate: number
  changes: HistoryChange[]
  onClose: () => void
}

export function PriceHistoryPopup({ stockName, currentPrice, currentChangeRate, changes, onClose }: PriceHistoryPopupProps) {
  const { handleRef, sheetRef } = useSwipeToDismiss(onClose)

  // 최신순 정렬 (changes[0]이 오늘)
  const reversed = [...changes].reverse()

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

      <div ref={sheetRef} className="relative w-full sm:w-96 sm:max-w-[90vw] max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
        {/* 모바일 드래그 핸들 */}
        <div ref={handleRef} className="sm:hidden flex justify-center mb-2 py-3 cursor-grab">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-semibold">{stockName}</span>
            <span className="text-xs text-muted-foreground ml-2">최근 {reversed.length}일 변동</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
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
                  "py-2 px-1",
                  isToday && "bg-muted/40 rounded-md font-medium",
                  idx < reversed.length - 1 && "border-b border-border/20"
                )}
              >
                {/* 1행: 일자 + 종가 + 등락률 */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] sm:text-xs text-muted-foreground font-semibold w-8 shrink-0 tabular-nums">{label}</span>
                  <span className="text-[8px] sm:text-[9px] text-muted-foreground/50 w-10 shrink-0 hidden sm:block">{c.date.slice(5)}</span>
                  <span className="text-[11px] sm:text-xs font-bold tabular-nums flex-1 text-right">
                    {close > 0 ? formatPrice(close) : "-"}
                    <span className="text-muted-foreground/50 text-[9px] ml-0.5">원</span>
                  </span>
                  <span className={cn(
                    "text-[10px] sm:text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded shrink-0 min-w-[3.5rem] text-right",
                    getChangeBgColor(rate)
                  )}>
                    {rate > 0 ? "+" : ""}{rate.toFixed(1)}%
                  </span>
                </div>
                {/* 2행: 거래량 + 거래대금 */}
                <div className="flex items-center gap-2 mt-0.5 ml-8 sm:ml-[4.5rem]">
                  <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                    거래량 <span className="text-muted-foreground">{c.volume != null && c.volume > 0 ? formatVolume(c.volume) : "-"}</span>
                  </span>
                  <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                    거래대금 <span className="text-muted-foreground">{c.trading_value != null && c.trading_value > 0 ? formatTradingValue(c.trading_value) : "-"}</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
