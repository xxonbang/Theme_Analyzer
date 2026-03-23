import { cn } from "@/lib/utils"

interface TakeProfitSliderProps {
  value: number | null  // null = off
  onChange: (value: number | null) => void
  label?: string
  /** 익절 적용 후 시뮬레이션 수익률 */
  simulatedRate?: number
  /** 원래 수익률 (비교용) */
  originalRate?: number
  compact?: boolean
}

export function TakeProfitSlider({ value, onChange, label, simulatedRate, originalRate, compact }: TakeProfitSliderProps) {
  const isActive = value !== null
  const displayValue = value ?? 5

  return (
    <div className={cn("flex items-center gap-2", compact ? "mt-1.5" : "mt-2")}>
      {label && <span className="text-[10px] text-muted-foreground shrink-0">{label}</span>}
      <button
        onClick={() => onChange(isActive ? null : 5)}
        className={cn(
          "text-[10px] px-1.5 py-0.5 rounded border transition-colors shrink-0",
          isActive
            ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
            : "border-border text-muted-foreground hover:text-foreground"
        )}
      >
        익절
      </button>
      {isActive && (
        <>
          <input
            type="range"
            min={0.5}
            max={30}
            step={0.5}
            value={displayValue}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 h-1 accent-amber-500 cursor-pointer"
          />
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums w-10 text-right shrink-0">
            +{displayValue}%
          </span>
        </>
      )}
      {isActive && simulatedRate !== undefined && originalRate !== undefined && simulatedRate !== originalRate && (
        <span className={cn(
          "text-[10px] tabular-nums shrink-0",
          simulatedRate > originalRate ? "text-red-500" : "text-blue-500"
        )}>
          →{simulatedRate >= 0 ? "+" : ""}{simulatedRate}%
        </span>
      )}
    </div>
  )
}

/** 익절 라인 적용: 최고가 수익률이 라인 이상이면 라인에서 매도, 아니면 실제 수익률 유지 */
export function applyTakeProfit(
  profitRate: number,
  highProfitRate: number | undefined,
  takeProfitPct: number | null,
): number {
  if (takeProfitPct === null) return profitRate
  const maxRate = highProfitRate ?? profitRate
  if (maxRate >= takeProfitPct) return takeProfitPct
  return profitRate
}
