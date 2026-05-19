// VWAP / RVOL / 30일 순위 / 거래 집중 계산 공통 헬퍼.
// PortfolioPage·StockCard 등 종목 카드에서 공유.

const STALE_THRESHOLD_DAYS = 7  // 7캘린더일 (≈ 5영업일) 이상 오래된 데이터를 stale로 간주

/**
 * stock-history changes의 가장 최근 날짜가 5영업일 이상 옛날이면 stale.
 * stale인 종목은 RVOL/30일 순위/D 등락률 등 시점 일관성이 필요한 지표 미표시 권장.
 */
export function isHistoryStale(latestChangeDate: string | undefined | null): boolean {
  if (!latestChangeDate) return true
  const now = new Date()
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
  const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`
  const todayMs = new Date(todayStr).getTime()
  const latestMs = new Date(latestChangeDate).getTime()
  if (isNaN(latestMs)) return true
  const diffDays = (todayMs - latestMs) / (24 * 60 * 60 * 1000)
  return diffDays > STALE_THRESHOLD_DAYS
}

// CLEANUP after 2026-05-31: stock-history가 UN으로 완전 마이그레이션되면 분기 제거.
export const RVOL_HISTORY_UN_CUTOFF_MS = new Date("2026-05-31T15:30:00+09:00").getTime()

// 정규장 09:00~15:30 경과 비율 (KST). 장 시작 전이면 null.
// 휴장일(주말)에는 KIS UN 시세가 직전 영업일 마감 데이터를 반환하므로 elapsed=1로 처리
// — VWAP·현재가 등 다른 지표와 동일한 정책으로 일관성 유지.
export function getMarketElapsedRatio(): number | null {
  const now = new Date()
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
  const day = kst.getDay()  // 0=일, 6=토
  if (day === 0 || day === 6) return 1  // 휴장일: 직전 영업일 마감 데이터 기준
  const minutes = kst.getHours() * 60 + kst.getMinutes()
  const open = 9 * 60
  const close = 15 * 60 + 30
  if (minutes < open) return null
  if (minutes >= close) return 1
  return (minutes - open) / (close - open)
}

export interface VwapResult {
  vwap: number | null
  vwapDiffPct: number | null
}

export function calculateVwap(tradingValue: number, volume: number, currentPrice: number | null | undefined): VwapResult {
  if (!(volume > 0 && tradingValue > 0)) return { vwap: null, vwapDiffPct: null }
  const vwap = tradingValue / volume
  const vwapDiffPct = currentPrice ? ((currentPrice - vwap) / vwap) * 100 : null
  return { vwap, vwapDiffPct }
}

export function calculateRvol(currentVol: number, historicalVols: number[], elapsed: number | null): number | null {
  if (currentVol <= 0 || historicalVols.length === 0 || elapsed === null || elapsed <= 0) return null
  const avg = historicalVols.reduce((a, b) => a + b, 0) / historicalVols.length
  if (avg <= 0) return null
  return currentVol / (avg * elapsed)
}

export interface Rank30Result {
  rank: number | null
  total: number | null
}

export function calculateRank30(currentVol: number, historicalVols: number[]): Rank30Result {
  if (currentVol <= 0 || historicalVols.length < 9) return { rank: null, total: null }
  const allVols = [currentVol, ...historicalVols]
  const sorted = [...allVols].sort((a, b) => b - a)
  // 동률 시 평균 위치(fractional rank) — 통계 표준 방식.
  // 같은 거래량이 여럿 있으면 그 그룹의 first/last 위치 평균.
  const firstIdx = sorted.indexOf(currentVol)
  const lastIdx = sorted.lastIndexOf(currentVol)
  const avgRank = (firstIdx + lastIdx) / 2 + 1
  return { rank: avgRank, total: allVols.length }
}

export interface ConcentrationItem { price: number; pct: number }

export function calculateConcentration(bins: { price: number; volume: number }[] | undefined): ConcentrationItem[] | null {
  if (!bins || bins.length === 0) return null
  const total = bins.reduce((a, b) => a + (b.volume ?? 0), 0)
  if (total <= 0) return null
  return [...bins]
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 3)
    .map(b => ({ price: b.price, pct: ((b.volume ?? 0) / total) * 100 }))
}
