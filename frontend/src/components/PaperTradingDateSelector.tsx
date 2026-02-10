import { CheckSquare, Square, CheckCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PaperTradingIndexEntry } from "@/types/stock"

interface PaperTradingDateSelectorProps {
  entries: PaperTradingIndexEntry[]
  selectedDates: Set<string>
  onToggleDate: (date: string) => void
  onToggleAll: () => void
}

function getWeekday(dateStr: string) {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
  const [year, month, day] = dateStr.split("-")
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return weekdays[date.getDay()]
}

export function PaperTradingDateSelector({
  entries,
  selectedDates,
  onToggleDate,
  onToggleAll,
}: PaperTradingDateSelectorProps) {
  const allSelected = entries.length > 0 && selectedDates.size === entries.length

  return (
    <div className="space-y-2">
      {/* 전체 선택/해제 */}
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-medium text-muted-foreground">날짜 선택</span>
        <button
          onClick={onToggleAll}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-xs",
            "transition-colors duration-150",
            "hover:bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          <CheckCheck className="w-3.5 h-3.5" />
          {allSelected ? "전체 해제" : "전체 선택"}
        </button>
      </div>

      {/* 날짜 리스트 */}
      {entries.length === 0 ? (
        <div className="text-xs sm:text-sm text-muted-foreground text-center py-4">
          아직 모의투자 데이터가 없습니다.
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map(entry => {
            const selected = selectedDates.has(entry.date)
            const isProfit = entry.total_profit_rate > 0
            const isLoss = entry.total_profit_rate < 0
            const sign = entry.total_profit_rate >= 0 ? "+" : ""

            return (
              <button
                key={entry.date}
                onClick={() => onToggleDate(entry.date)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg",
                  "text-xs sm:text-sm transition-all duration-150",
                  selected
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-muted/30 border border-transparent hover:bg-muted/60",
                )}
              >
                <div className="flex items-center gap-2">
                  {selected ? (
                    <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium">
                    {entry.date.replace(/-/g, ".")}
                    <span className="text-muted-foreground ml-1">({getWeekday(entry.date)})</span>
                  </span>
                  <span className="text-muted-foreground">
                    {entry.stock_count}종목
                  </span>
                </div>
                <span className={cn(
                  "font-semibold tabular-nums",
                  isProfit && "text-red-600",
                  isLoss && "text-blue-600",
                  !isProfit && !isLoss && "text-muted-foreground",
                )}>
                  {sign}{entry.total_profit_rate}%
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
