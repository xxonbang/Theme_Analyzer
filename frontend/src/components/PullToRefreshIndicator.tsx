import { ArrowDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  pullDistance: number
  canRelease: boolean
  isRefreshing: boolean
}

export function PullToRefreshIndicator({ pullDistance, canRelease, isRefreshing }: Props) {
  if (pullDistance === 0 && !isRefreshing) return null

  const rotation = canRelease ? 180 : (pullDistance / 60) * 180

  return (
    <div
      className="flex items-center justify-center overflow-hidden"
      style={{ height: isRefreshing ? 48 : pullDistance }}
    >
      {isRefreshing ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : (
        <ArrowDown
          className={cn("w-5 h-5 text-muted-foreground transition-transform")}
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      )}
    </div>
  )
}
