import { useState, useRef, useEffect } from "react"

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
  enabled?: boolean
  threshold?: number
}

export function usePullToRefresh({
  onRefresh,
  enabled = true,
  threshold = 60,
}: UsePullToRefreshOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const startY = useRef(0)
  const pulling = useRef(false)
  const distanceRef = useRef(0)

  // Refs to avoid stale closures in event handlers
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  const enabledRef = useRef(enabled)
  onRefreshRef.current = onRefresh
  enabledRef.current = enabled
  refreshingRef.current = isRefreshing

  const canRelease = pullDistance >= threshold

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current || refreshingRef.current) return
      if (window.scrollY > 0) return
      startY.current = e.touches[0].clientY
      pulling.current = true
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        distanceRef.current = 0
        setPullDistance(0)
        return
      }
      e.preventDefault()
      const distance = Math.min(dy * 0.4, 120)
      distanceRef.current = distance
      setPullDistance(distance)
    }

    const onTouchEnd = () => {
      if (!pulling.current) return
      pulling.current = false
      if (distanceRef.current >= threshold) {
        setIsRefreshing(true)
        setPullDistance(0)
        onRefreshRef.current().finally(() => {
          setIsRefreshing(false)
        })
      } else {
        setPullDistance(0)
      }
      distanceRef.current = 0
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    el.addEventListener("touchend", onTouchEnd)

    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
    }
  }, [threshold])

  return { containerRef, pullDistance, isRefreshing, canRelease }
}
