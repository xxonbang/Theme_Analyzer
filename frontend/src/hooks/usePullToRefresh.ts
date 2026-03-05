import { useState, useRef, useEffect } from "react"

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
  enabled?: boolean
  threshold?: number
}

/** 크로스 브라우저/WebView 호환 스크롤 위치 */
function getScrollTop(): number {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
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
      // iOS standalone(PWA) 모드 호환: 1px 이하 허용
      if (getScrollTop() > 1) return
      startY.current = e.touches[0].clientY
      pulling.current = true
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current) return
      if (getScrollTop() > 1) {
        pulling.current = false
        distanceRef.current = 0
        setPullDistance(0)
        return
      }
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

    // iOS standalone: document 레벨에서도 이벤트 수신
    document.addEventListener("touchstart", onTouchStart, { passive: true })
    document.addEventListener("touchmove", onTouchMove, { passive: false })
    document.addEventListener("touchend", onTouchEnd)

    return () => {
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onTouchEnd)
    }
  }, [threshold])

  return { containerRef, pullDistance, isRefreshing, canRelease }
}
