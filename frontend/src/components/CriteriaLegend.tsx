import { Crown } from "lucide-react"
import { CRITERIA_CONFIG } from "@/lib/criteria"

export function CriteriaLegend() {
  const normalCriteria = CRITERIA_CONFIG.filter(c => !c.warning)
  const warningCriteria = CRITERIA_CONFIG.filter(c => c.warning)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 bg-muted/40 rounded-lg text-[10px] sm:text-xs text-muted-foreground">
      <span className="font-medium text-foreground/70">선정 기준:</span>
      {normalCriteria.map(({ dot, label }) => (
        <span key={label} className="flex items-center gap-1">
          <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${dot}`} />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
        52주 신고가
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ring-1 ring-yellow-400 bg-yellow-400/30" />
        전체 충족
      </span>
      <span className="font-medium text-foreground/70 ml-1">경고:</span>
      {warningCriteria.map(({ dot, label }) => (
        <span key={label} className="flex items-center gap-1">
          <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${dot} animate-pulse`} />
          {label}
        </span>
      ))}
    </div>
  )
}
