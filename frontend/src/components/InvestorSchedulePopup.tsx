import { createPortal } from "react-dom"
import { X, Clock, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const SCHEDULE = [
  { round: 1, time: "09:35", source: "외국인 09:30 반영", label: "1차" },
  { round: 2, time: "10:05", source: "기관 10:00 반영", label: "2차" },
  { round: 3, time: "11:25", source: "외국인+기관 11:20 반영", label: "3차" },
  { round: 4, time: "13:25", source: "외국인+기관 13:20 반영", label: "4차" },
  { round: 5, time: "14:35", source: "외국인+기관 14:30 반영 (장중 최종)", label: "5차" },
  { round: 0, time: "15:45", source: "장 마감 후 확정 데이터 수집", label: "확정" },
  { round: 0, time: "18:05", source: "확정 데이터 + pykrx 교차검증", label: "확정" },
]

interface Props {
  currentRound: string // "1차", "2차", ... 또는 "확정"
  updatedAt: string
  onClose: () => void
}

export function InvestorSchedulePopup({ currentRound, updatedAt, onClose }: Props) {
  const timeStr = updatedAt.slice(11, 16)

  return createPortal(
    <div className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-full sm:w-80 sm:max-w-[90vw] bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold">수급 데이터 수집 스케줄</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 현재 상태 */}
        <div className="text-xs text-muted-foreground mb-3 bg-muted/40 rounded px-2.5 py-1.5">
          현재: <span className="font-medium text-foreground">{currentRound}</span> · 수집 시각 {timeStr}
        </div>

        {/* 스케줄 테이블 */}
        <div className="space-y-0">
          <div className="flex items-center text-[9px] text-muted-foreground font-medium pb-1.5 border-b border-border/50">
            <span className="w-9 shrink-0">라운드</span>
            <span className="w-11 shrink-0">시간</span>
            <span className="flex-1">반영 데이터</span>
          </div>
          {SCHEDULE.map((s, idx) => {
            const isPast = timeStr >= s.time
            const isCurrent = currentRound === s.label && isPast
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-center py-1.5 text-[10px]",
                  idx < SCHEDULE.length - 1 && "border-b border-border/20",
                  isCurrent && "bg-primary/5 -mx-1 px-1 rounded font-medium",
                )}
              >
                <span className={cn("w-9 shrink-0 font-medium", isCurrent ? "text-primary" : isPast ? "text-muted-foreground" : "text-muted-foreground/50")}>
                  {s.round > 0 ? `${s.round}차` : "-"}
                </span>
                <span className={cn("w-11 shrink-0 tabular-nums", isCurrent ? "text-primary" : isPast ? "text-foreground" : "text-muted-foreground/50")}>
                  {s.time}
                </span>
                <span className={cn("flex-1", isPast ? "text-muted-foreground" : "text-muted-foreground/50")}>
                  {s.source}
                </span>
                {isCurrent && <Check className="w-3 h-3 text-primary shrink-0 ml-1" />}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
