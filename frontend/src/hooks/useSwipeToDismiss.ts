import { useRef, useEffect, useCallback } from "react"

/**
 * Bottom sheet 핸들 바를 아래로 스와이프하면 닫히는 동작.
 * handleRef → 드래그 핸들 영역, sheetRef → bottom sheet 컨테이너.
 */
export function useSwipeToDismiss(onClose: () => void, threshold = 80) {
  const handleRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const deltaY = useRef(0)

  const stableClose = useCallback(onClose, [onClose])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return

    const onTouchStart = (e: TouchEvent) => {
      startY.current = e.touches[0].clientY
      deltaY.current = 0
      const sheet = sheetRef.current
      if (sheet) sheet.style.transition = "none"
    }

    const onTouchMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - startY.current
      if (dy < 0) { deltaY.current = 0; return }
      deltaY.current = dy
      const sheet = sheetRef.current
      if (sheet) {
        sheet.style.transform = `translateY(${dy}px)`
        sheet.style.opacity = `${Math.max(0.3, 1 - dy / 400)}`
      }
    }

    const onTouchEnd = () => {
      const sheet = sheetRef.current
      if (!sheet) return
      sheet.style.transition = "transform 0.2s ease-out, opacity 0.2s ease-out"
      if (deltaY.current > threshold) {
        sheet.style.transform = "translateY(100%)"
        sheet.style.opacity = "0"
        setTimeout(stableClose, 200)
      } else {
        sheet.style.transform = "translateY(0)"
        sheet.style.opacity = "1"
      }
    }

    handle.addEventListener("touchstart", onTouchStart, { passive: true })
    handle.addEventListener("touchmove", onTouchMove, { passive: true })
    handle.addEventListener("touchend", onTouchEnd)

    return () => {
      handle.removeEventListener("touchstart", onTouchStart)
      handle.removeEventListener("touchmove", onTouchMove)
      handle.removeEventListener("touchend", onTouchEnd)
    }
  }, [stableClose, threshold])

  return { handleRef, sheetRef }
}
