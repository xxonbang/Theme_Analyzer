import { ArrowDown, Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  pullDistance: number
  canRelease: boolean
  isRefreshing: boolean
  justCompleted?: boolean
}

export function PullToRefreshIndicator({ pullDistance, canRelease, isRefreshing, justCompleted }: Props) {
  if (pullDistance === 0 && !isRefreshing && !justCompleted) return null

  const rotation = canRelease ? 180 : (pullDistance / 60) * 180
  const opacity = Math.min(1, pullDistance / 60)

  return (
    <div
      className="flex items-center justify-center gap-1.5 overflow-hidden transition-[height] duration-200 ease-out text-xs"
      style={{ height: isRefreshing || justCompleted ? 48 : pullDistance }}
    >
      {justCompleted ? (
        <>
          <Check className="w-4 h-4 text-emerald-500" strokeWidth={3} />
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">갱신 완료</span>
        </>
      ) : isRefreshing ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
          <span className="text-muted-foreground">갱신 중…</span>
        </>
      ) : (
        <ArrowDown
          className={cn(
            "w-5 h-5 text-muted-foreground",
            canRelease && "text-primary"
          )}
          style={{
            transform: `rotate(${rotation}deg)`,
            opacity,
            transition: "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), color 0.15s",
          }}
        />
      )}
    </div>
  )
}
