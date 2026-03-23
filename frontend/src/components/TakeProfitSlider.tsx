import { cn } from "@/lib/utils"

export interface TPSLValues {
  tp: number | null  // 익절 % (null = off)
  sl: number | null  // 손절 % (null = off, 음수 저장)
}

interface TakeProfitSliderProps {
  value: TPSLValues
  onChange: (value: TPSLValues) => void
  label?: string
  simulatedRate?: number
  originalRate?: number
  compact?: boolean
}

function StepButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
    >
      {children}
    </button>
  )
}

export function TakeProfitSlider({ value, onChange, label, simulatedRate, originalRate, compact }: TakeProfitSliderProps) {
  const tpActive = value.tp !== null
  const slActive = value.sl !== null
  const tpVal = value.tp ?? 5
  const slVal = value.sl ?? -3
  const hasChange = simulatedRate !== undefined && originalRate !== undefined && simulatedRate !== originalRate

  const setTP = (tp: number | null) => onChange({ ...value, tp })
  const setSL = (sl: number | null) => onChange({ ...value, sl })
  const clampTP = (v: number) => Math.max(0.5, Math.min(30, Math.round(v * 2) / 2))
  const clampSL = (v: number) => Math.max(-30, Math.min(-0.5, Math.round(v * 2) / 2))

  return (
    <div className={cn("space-y-1", compact ? "py-1" : "py-1.5")}>
      {/* 익절 라인 */}
      <div className="flex items-center gap-1.5">
        {label && <span className="text-[10px] text-muted-foreground shrink-0 w-7">{label}</span>}
        <button
          onClick={() => setTP(tpActive ? null : 5)}
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded border transition-colors shrink-0",
            tpActive
              ? "bg-red-500/10 border-red-500/25 text-red-500"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          익절
        </button>
        {tpActive && (
          <>
            <StepButton onClick={() => setTP(clampTP(tpVal - 0.5))}>−</StepButton>
            <input
              type="range" min={0.5} max={30} step={0.5} value={tpVal}
              onChange={(e) => setTP(Number(e.target.value))}
              className="flex-1 h-1 accent-red-500 cursor-pointer min-w-0"
            />
            <StepButton onClick={() => setTP(clampTP(tpVal + 0.5))}>+</StepButton>
            <span className="text-[11px] font-semibold text-red-500 tabular-nums shrink-0 w-12 text-right">
              +{tpVal}%
            </span>
            {/* 시뮬레이션 결과 */}
            <span className={cn(
              "text-[10px] tabular-nums shrink-0 w-16 text-right",
              hasChange
                ? (simulatedRate! > 0 ? "text-red-500" : simulatedRate! < 0 ? "text-blue-500" : "text-muted-foreground")
                : "text-muted-foreground/50"
            )}>
              {hasChange
                ? `→${simulatedRate! >= 0 ? "+" : ""}${simulatedRate}%`
                : (tpActive || slActive) ? "=" : ""}
            </span>
          </>
        )}
      </div>

      {/* 손절 라인 */}
      <div className="flex items-center gap-1.5">
        {label && <span className="text-[10px] shrink-0 w-7" />}
        <button
          onClick={() => setSL(slActive ? null : -3)}
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded border transition-colors shrink-0",
            slActive
              ? "bg-blue-500/10 border-blue-500/25 text-blue-500"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          손절
        </button>
        {slActive && (
          <>
            <StepButton onClick={() => setSL(clampSL(slVal - 0.5))}>−</StepButton>
            <input
              type="range" min={-30} max={-0.5} step={0.5} value={slVal}
              onChange={(e) => setSL(Number(e.target.value))}
              className="flex-1 h-1 accent-blue-500 cursor-pointer min-w-0"
            />
            <StepButton onClick={() => setSL(clampSL(slVal + 0.5))}>+</StepButton>
            <span className="text-[11px] font-semibold text-blue-500 tabular-nums shrink-0 w-12 text-right">
              {slVal}%
            </span>
            {/* 익절 행의 시뮬레이션 결과 영역과 폭 맞춤 */}
            <span className="shrink-0 w-16" />
          </>
        )}
      </div>
    </div>
  )
}

/** 익절+손절 적용:
 * - 최고가 수익률 >= 익절라인 → 익절%에서 매도
 * - 최저가 수익률 <= 손절라인 → 손절%에서 매도 (최저가 데이터 없으면 종가 기준 fallback)
 * - 둘 다 해당 → 익절 우선 (장중 익절이 먼저 발동한 것으로 가정)
 */
export function applyTPSL(
  profitRate: number,
  highProfitRate: number | undefined,
  tpsl: TPSLValues,
  lowProfitRate?: number,
): number {
  const { tp, sl } = tpsl
  // 익절 체크: 최고가 수익률이 익절라인 이상이면 익절
  if (tp !== null) {
    const maxRate = highProfitRate ?? profitRate
    if (maxRate >= tp) return tp
  }
  // 손절 체크: 최저가 수익률(또는 종가)이 손절라인 이하이면 손절
  if (sl !== null) {
    const minRate = lowProfitRate ?? profitRate
    if (minRate <= sl) return sl
  }
  return profitRate
}
