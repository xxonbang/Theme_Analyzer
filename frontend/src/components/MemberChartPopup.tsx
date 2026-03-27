import { useEffect } from "react"
import { createPortal } from "react-dom"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MemberInfo } from "@/types/stock"

interface MemberChartPopupProps {
  stockName: string
  memberInfo: MemberInfo
  onClose: () => void
}

function shortenName(name: string): string {
  return name
    .replace(/증권$/, "")
    .replace(/투자증권$/, "")
    .replace(/에셋증권$/, "에셋")
    .replace(/만삭스$/, "만")
    .replace(/린치증권$/, "린치")
    .replace(/모건증권$/, "모건")
}

export function MemberChartPopup({ stockName, memberInfo, onClose }: MemberChartPopupProps) {
  const { handleRef, sheetRef } = useSwipeToDismiss(onClose)

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [onClose])

  const { buy_top5, sell_top5 } = memberInfo
  const sellTotal = memberInfo.total_sell_qty || sell_top5.reduce((s, b) => s + b.qty, 0)
  const buyTotal = memberInfo.total_buy_qty || buy_top5.reduce((s, b) => s + b.qty, 0)
  const maxQty = Math.max(...sell_top5.map(b => b.qty), ...buy_top5.map(b => b.qty), 1)

  // 바 차트 상수
  const BAR_MAX_H = 120
  const BAR_W = 32
  const GAP = 6
  const buyCount = buy_top5.length

  return createPortal(
    <div
      ref={handleRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={sheetRef}
        className="bg-background rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto shadow-xl max-h-[85vh] overflow-y-auto"
      >
        {/* 모바일 드래그 핸들 + 닫기 */}
        <div className="sm:hidden flex items-center justify-center pt-3 pb-1 relative">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
          <button onClick={onClose} className="absolute right-4 text-muted-foreground hover:text-foreground p-1" aria-label="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 헤더 */}
        <div className="sticky top-0 bg-background z-10 flex items-center justify-between px-4 pt-4 sm:pt-4 pb-2 border-b border-border/30">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{stockName}</span>
            <span className="text-xs text-muted-foreground">거래원</span>
          </div>
          <button onClick={onClose} className="hidden sm:block p-1 rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 합계 */}
        <div className="grid grid-cols-2 gap-4 px-4 pt-3 pb-2">
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">매도합계</p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">{sellTotal.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground font-medium">매수합계</p>
            <p className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">{buyTotal.toLocaleString()}</p>
          </div>
        </div>

        {/* 바 차트 */}
        <div className="px-4 pb-3">
          <div className="flex items-end justify-center" style={{ height: BAR_MAX_H + 28 }}>
            {/* 매도 바 (파란색, 왼쪽) — 역순: 5위→1위 (우측이 1위) */}
            {[...sell_top5].reverse().map((b, i) => {
              const h = Math.max((b.qty / maxQty) * BAR_MAX_H, 4)
              return (
                <div key={`sell-${i}`} className="flex flex-col items-center" style={{ width: BAR_W, marginRight: GAP }}>
                  <span className="text-[10px] text-muted-foreground mb-0.5 whitespace-nowrap">{shortenName(b.name)}</span>
                  <div
                    className="w-full rounded-t bg-blue-400 dark:bg-blue-500"
                    style={{ height: h }}
                  />
                </div>
              )
            })}
            {/* 중간 간격 */}
            <div style={{ width: 16 }} />
            {/* 매수 바 (빨간색, 오른쪽) */}
            {buy_top5.map((b, i) => {
              const h = Math.max((b.qty / maxQty) * BAR_MAX_H, 4)
              return (
                <div key={`buy-${i}`} className="flex flex-col items-center" style={{ width: BAR_W, marginRight: i < buyCount - 1 ? GAP : 0 }}>
                  <span className="text-[10px] text-muted-foreground mb-0.5 whitespace-nowrap">{shortenName(b.name)}</span>
                  <div
                    className="w-full rounded-t bg-rose-400 dark:bg-rose-500"
                    style={{ height: h }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* 테이블 */}
        <div className="px-4 pb-4">
          {/* 헤더 */}
          <div className="grid grid-cols-[1fr_auto_auto_1fr] text-[10px] sm:text-[11px] font-semibold text-muted-foreground border-b border-border py-1.5">
            <span className="text-right pr-2">매도수량</span>
            <span className="text-blue-600 dark:text-blue-400 text-center w-20 sm:w-24">매도상위</span>
            <span className="text-rose-600 dark:text-rose-400 text-center w-20 sm:w-24">매수상위</span>
            <span className="pl-2">매수수량</span>
          </div>
          {/* 행 */}
          {Array.from({ length: Math.max(sell_top5.length, buy_top5.length) }).map((_, i) => {
            const sell = sell_top5[i]
            const buy = buy_top5[i]
            const sellPct = sell ? (sell.qty / maxQty) * 100 : 0
            const buyPct = buy ? (buy.qty / maxQty) * 100 : 0
            return (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_1fr] text-[10px] sm:text-[11px] border-b border-border/20">
                {/* 매도수량 — 우측정렬 + 우→좌 막대바 */}
                <div className="relative flex items-center justify-end pr-2 py-1.5">
                  <div className="absolute inset-y-0 right-0 bg-blue-100 dark:bg-blue-900/40 rounded-l" style={{ width: `${sellPct}%` }} />
                  <span className={cn("relative z-10 tabular-nums", sell?.is_foreign ? "text-blue-600 dark:text-blue-400" : "text-blue-500/80 dark:text-blue-300/80")}>
                    {sell ? sell.qty.toLocaleString() : ""}
                  </span>
                </div>
                {/* 매도상위 */}
                <span className={cn("flex items-center justify-center w-20 sm:w-24 py-1.5 font-medium", sell?.is_foreign && "text-red-500 underline")}>
                  {sell?.name || ""}
                </span>
                {/* 매수상위 */}
                <span className={cn("flex items-center justify-center w-20 sm:w-24 py-1.5 font-medium", buy?.is_foreign && "text-red-500 underline")}>
                  {buy?.name || ""}
                </span>
                {/* 매수수량 — 좌측정렬 + 좌→우 막대바 */}
                <div className="relative flex items-center pl-2 py-1.5">
                  <div className="absolute inset-y-0 left-0 bg-rose-100 dark:bg-rose-900/40 rounded-r" style={{ width: `${buyPct}%` }} />
                  <span className={cn("relative z-10 tabular-nums", buy?.is_foreign ? "text-rose-600 dark:text-rose-400" : "text-rose-500/80 dark:text-rose-300/80")}>
                    {buy ? buy.qty.toLocaleString() : ""}
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
