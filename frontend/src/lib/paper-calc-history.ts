import { supabase } from "./supabase"

export interface PaperCalcItem {
  id: string
  code: string
  name: string
  assumedPrice: number
  quantity: number
  addedAt: string
}

export interface ScenarioTab {
  id: string
  name: string
  items: PaperCalcItem[]
}

export interface PaperCalcState {
  tabs: ScenarioTab[]
  activeTabId: string
}

/**
 * Supabase paper_calc_history에서 전체 state(tabs + activeTabId)를 가져옵니다.
 * - 미로그인: null 반환 (호출자가 로컬 fallback 사용)
 * - 로그인 + row 없음: 빈 state 반환 (호출자가 기본 탭 자동 생성)
 */
export async function fetchPaperCalcState(): Promise<PaperCalcState | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from("paper_calc_history")
    .select("tabs, active_tab_id")
    .eq("user_id", user.id)
    .maybeSingle()
  if (error || !data) return { tabs: [], activeTabId: "" }
  const tabs = Array.isArray(data.tabs) ? (data.tabs as ScenarioTab[]) : []
  return { tabs, activeTabId: (data.active_tab_id as string) || tabs[0]?.id || "" }
}

/**
 * 전체 state를 upsert합니다. stock_toolkit과 동일 스키마.
 * 미로그인 시 false 반환 (호출자는 무시 가능).
 */
export async function savePaperCalcState(state: PaperCalcState): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from("paper_calc_history")
    .upsert({
      user_id: user.id,
      tabs: state.tabs,
      active_tab_id: state.activeTabId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
  return !error
}
