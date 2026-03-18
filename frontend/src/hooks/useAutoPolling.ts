import { useEffect, useRef } from "react"

/** KST 기준 장중(평일 09:00~15:30) 여부 판별 */
function isMarketHours(): boolean {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const kst = new Date(utc + 9 * 3600000)
  const day = kst.getDay()
  if (day === 0 || day === 6) return false
  const hhmm = kst.getHours() * 100 + kst.getMinutes()
  return hhmm >= 900 && hhmm <= 1530
}

/**
 * 장중일 때만 interval 간격으로 refetch를 호출하는 훅.
 * @param refetch - 데이터 재조회 함수
 * @param intervalMs - 폴링 간격 (기본 60초)
 */
export function useAutoPolling(refetch: () => void, intervalMs = 60_000) {
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  useEffect(() => {
    const timer = setInterval(() => {
      if (isMarketHours()) {
        refetchRef.current()
      }
    }, intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
}
