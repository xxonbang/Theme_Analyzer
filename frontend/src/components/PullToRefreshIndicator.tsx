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

  const opacity = Math.min(1, pullDistance / 60)

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
      style={{ height: isRefreshing ? 48 : pullDistance }}
    >
      {isRefreshing ? (
        <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
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
