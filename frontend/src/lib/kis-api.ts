import { supabase } from "./supabase"

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
  const { data, error } = await supabase.functions.invoke("kis-proxy", { body })

  if (error) {
    throw new Error(error.message || "Edge Function 호출 실패")
  }
  if (data?.error) {
    throw new Error(data.error)
  }
  return data
}

/**
 * KIS API를 통해 여러 종목의 실시간 시세를 조회합니다.
 * 부분 실패 시 성공 종목만 반환하되, failed 수를 포함합니다.
 */
export async function fetchKisPrices(codes: string[]): Promise<{ prices: Record<string, KisStockPrice>; failed: number }> {
  if (codes.length === 0) return { prices: {}, failed: 0 }
  const data = await callKisProxy({ action: "prices", codes })
  return {
    prices: (data.prices as Record<string, KisStockPrice>) ?? {},
    failed: (data.failed as number) ?? 0,
  }
}

export interface KisExchangeRate {
  rate: number
  change: number
  changeRate: number
}

/**
 * KIS API를 통해 실시간 환율을 조회합니다. (USD, JPY, EUR, CNY)
 */
export async function fetchKisExchangeRates(): Promise<Record<string, KisExchangeRate>> {
  const data = await callKisProxy({ action: "exchange" })
  return (data.rates as Record<string, KisExchangeRate>) ?? {}
}

/**
 * 텔레그램 알림 설정 조회
 */
export async function getNotifyEnabled(): Promise<boolean> {
  try {
    const data = await callKisProxy({ action: "get-notify" })
    return data.enabled === true
  } catch { return false }
}

/**
 * 텔레그램 알림 설정 변경
 */
export async function setNotifyEnabled(enabled: boolean): Promise<boolean> {
  try {
    const data = await callKisProxy({ action: "set-notify", enabled })
    return data.ok === true
  } catch { return false }
}

/**
 * KIS API를 통해 단일 종목을 코드로 검색합니다.
 */
export async function searchKisStock(code: string): Promise<KisStockPrice | null> {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) return null
  const data = await callKisProxy({ action: "search", code })
  return (data.stock as KisStockPrice) ?? null
}
