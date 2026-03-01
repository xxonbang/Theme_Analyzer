import { useEffect } from "react"
import { createPortal } from "react-dom"
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

      <div className="relative w-full sm:w-96 sm:max-w-[90vw] max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
        {/* 모바일 드래그 핸들 */}
        <div className="sm:hidden flex justify-center mb-2">
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

        {/* 테이블 */}
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-[9px] text-muted-foreground font-medium border-b border-border/50">
              <th className="text-left pb-1.5 font-medium">일자</th>
              <th className="text-right pb-1.5 font-medium">종가</th>
              <th className="text-right pb-1.5 font-medium">등락률</th>
              <th className="text-right pb-1.5 font-medium">거래량</th>
              <th className="text-right pb-1.5 font-medium">거래대금</th>
            </tr>
          </thead>
          <tbody>
            {reversed.map((c, idx) => {
              const isToday = idx === reversed.length - 1
              const label = isToday ? "D" : `D-${reversed.length - 1 - idx}`
              const rate = isToday ? currentChangeRate : c.change_rate
              const close = isToday ? currentPrice : (c.close || 0)

              return (
                <tr
                  key={idx}
                  className={cn(
                    isToday && "bg-muted/40 font-medium",
                    idx < reversed.length - 1 && "border-b border-border/20"
                  )}
                >
                  <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">
                    <span className="font-medium">{label}</span>
                    <span className="text-[8px] ml-0.5 hidden sm:inline">{c.date.slice(5)}</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-medium whitespace-nowrap">
                    {close > 0 ? formatPrice(close) : "-"}
                  </td>
                  <td className={cn("py-1.5 text-right tabular-nums font-medium whitespace-nowrap rounded px-0.5", getChangeBgColor(rate))}>
                    {rate > 0 ? "+" : ""}{rate.toFixed(1)}%
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {c.volume != null && c.volume > 0 ? formatVolume(c.volume) : "-"}
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {c.trading_value != null && c.trading_value > 0 ? formatTradingValue(c.trading_value) : "-"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>,
    document.body
  )
}
