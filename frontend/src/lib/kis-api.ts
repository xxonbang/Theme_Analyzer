const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kis-proxy`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface KisStockPrice {
  code: string
  name: string
  current_price: number
  change_rate: number
  change_amount: number
  volume: number
  market_cap: number
  w52_hgpr: number
  w52_lwpr: number
  per: number
  pbr: number
}

async function callKisProxy(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data
}

/**
 * KIS API를 통해 여러 종목의 실시간 시세를 조회합니다.
 */
export async function fetchKisPrices(codes: string[]): Promise<Record<string, KisStockPrice>> {
  if (codes.length === 0) return {}
  const data = await callKisProxy({ action: "prices", codes })
  return (data.prices as Record<string, KisStockPrice>) ?? {}
}

/**
 * KIS API를 통해 단일 종목을 코드로 검색합니다.
 */
export async function searchKisStock(code: string): Promise<KisStockPrice | null> {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) return null
  const data = await callKisProxy({ action: "search", code })
  return (data.stock as KisStockPrice) ?? null
}
