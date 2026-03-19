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

/**
 * KIS API를 통해 여러 종목의 실시간 시세를 조회합니다.
 * Supabase Edge Function(kis-proxy)을 프록시로 사용합니다.
 */
export async function fetchKisPrices(codes: string[]): Promise<Record<string, KisStockPrice>> {
  if (codes.length === 0) return {}

  const { data, error } = await supabase.functions.invoke("kis-proxy", {
    body: { action: "prices", codes },
  })

  if (error) {
    console.error("[KIS] fetchKisPrices error:", error)
    // Edge Function 응답 body 확인
    if (error instanceof Error && "context" in error) {
      console.error("[KIS] error context:", (error as Record<string, unknown>).context)
    }
    throw new Error(`KIS API 호출 실패: ${error.message}`)
  }
  if (data?.error) {
    console.error("[KIS] Edge Function error:", data.error)
    throw new Error(`KIS API 오류: ${data.error}`)
  }
  return (data?.prices as Record<string, KisStockPrice>) ?? {}
}

/**
 * KIS API를 통해 단일 종목을 코드로 검색합니다.
 * 기존 데이터에 없는 종목을 찾을 때 사용합니다.
 */
export async function searchKisStock(code: string): Promise<KisStockPrice | null> {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) return null

  const { data, error } = await supabase.functions.invoke("kis-proxy", {
    body: { action: "search", code },
  })

  if (error) throw new Error(`KIS API 호출 실패: ${error.message}`)
  return (data?.stock as KisStockPrice) ?? null
}
