import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Plus, Trash2, Edit3, Check, X, TrendingUp, TrendingDown,
  AlertTriangle, Briefcase, ExternalLink, ChevronDown, ChevronUp,
  RefreshCw, Search, Loader2, Calculator, History, HelpCircle,
} from "lucide-react"
import { cn, formatPrice } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { fetchKisPrices, searchKisStock, type KisStockPrice } from "@/lib/kis-api"
import type {
  StockData, FundamentalInfo, InvestorInfo, VolumeProfileData,
  ThemeForecast, Stock,
} from "@/types/stock"
import { AveragingDownCalc, type NewTransaction, type Transaction } from "./AveragingDownCalc"
import { AveragingDownSheet } from "./AveragingDownSheet"
import { PaperCalcTab } from "./PaperCalcTab"

// --- Types ---

interface Holding {
  id: string
  code: string
  name: string
  avgPrice: number
  quantity: number
  addedAt: string // ISO date
}

interface PortfolioPageProps {
  stockData: StockData | null
  volumeProfileData: VolumeProfileData | null
  themeForecast: ThemeForecast | null
  history: Record<string, { changes?: { volume?: number }[] }>
}

function VwapHelp() {
  return (
    <>
      <p className="leading-relaxed">
        오늘 하루 그 종목이 <strong className="text-foreground">평균적으로 얼마에 거래됐는지</strong> 보여주는 가격이에요.
      </p>
      <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-[13px] leading-relaxed">
        <div className="font-semibold text-foreground/90">어떻게 보면 좋을까요?</div>
        <div className="space-y-1.5">
          <div>
            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold text-red-500 bg-red-500/10 mr-1">현재가 &gt; VWAP</span>
            오늘 평균보다 비싸게 거래 중 — 매수자들이 평균 이상으로 사는 중. <strong className="text-foreground">강세 신호</strong>.
          </div>
          <div>
            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold text-blue-500 bg-blue-500/10 mr-1">현재가 &lt; VWAP</span>
            오늘 평균보다 싸게 거래 중 — <strong className="text-foreground">매수 기회</strong>이거나 약세 신호.
          </div>
        </div>
      </div>
      <div className="text-[12px] text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
        계산식: <span className="font-mono tabular-nums">누적 거래대금 ÷ 누적 거래량</span>
      </div>
    </>
  )
}

function RvolHelp() {
  return (
    <>
      <p className="leading-relaxed">
        지금 시각까지의 거래량이 <strong className="text-foreground">평소 대비 몇 배</strong>인지 알려주는 지표예요.
      </p>
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        최근 20일 평균 거래량과 비교하되, 정규장 경과 시간을 반영해서 공정하게 계산합니다.
      </p>
      <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-[13px] leading-relaxed">
        <div className="font-semibold text-foreground/90 mb-1">기준값 읽는 법</div>
        <div className="flex gap-2">
          <span className="font-mono font-bold tabular-nums text-foreground/85 shrink-0 w-14">1.0x</span>
          <span>평소 수준</span>
        </div>
        <div className="flex gap-2">
          <span className="font-mono font-bold tabular-nums text-amber-500 shrink-0 w-14">1.2~2.0x</span>
          <span>다소 활발 — 무언가 관심을 끄는 중</span>
        </div>
        <div className="flex gap-2">
          <span className="font-mono font-bold tabular-nums text-red-500 shrink-0 w-14">≥ 2.0x</span>
          <span>매우 활발 — <strong className="text-foreground">뉴스/이슈/추세 변화 가능성</strong></span>
        </div>
        <div className="flex gap-2">
          <span className="font-mono font-bold tabular-nums text-muted-foreground shrink-0 w-14">&lt; 1.0x</span>
          <span>평소보다 조용</span>
        </div>
      </div>
      <div className="text-[12px] text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
        계산식: <span className="font-mono tabular-nums">현재 누적 거래량 ÷ (20일 평균 × 정규장 경과 비율)</span>
      </div>
    </>
  )
}

// 정규장 09:00~15:30 경과 비율 (KST). 장 시작 전이면 null.
// 휴장일(주말)에는 KIS UN 시세가 직전 영업일 마감 데이터를 반환하므로 elapsed=1로 처리
// — VWAP·현재가 등 다른 지표와 동일한 정책으로 일관성 유지.
function getMarketElapsedRatio(): number | null {
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

// CLEANUP after 2026-05-31: stock-history가 UN으로 완전 마이그레이션되면 분기 제거.
// 이 cutoff 이전엔 live.krx_volume(KRX 단독) ÷ avgVol(KRX 단독) 사용,
// 이후엔 live.volume(UN) ÷ avgVol(UN) 사용 — 데이터 출처 일치성 확보.
const RVOL_HISTORY_UN_CUTOFF_MS = new Date("2026-05-31T15:30:00+09:00").getTime()

// --- Supabase persistence ---

async function fetchHoldingsFromDB(userId: string): Promise<Holding[]> {
  const { data, error } = await supabase
    .from("portfolio_holdings")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: true })

  if (error || !data) return []
  return data.map(row => ({
    id: row.id,
    code: row.code,
    name: row.name,
    avgPrice: row.avg_price,
    quantity: row.quantity,
    addedAt: row.added_at,
  }))
}

// --- Helpers ---

function buildStockMap(data: StockData | null): Map<string, Stock> {
  const map = new Map<string, Stock>()
  if (!data) return map
  const sections = [data.rising, data.falling, data.volume, data.trading_value]
  for (const sec of sections) {
    if (!sec) continue
    for (const s of [...(sec.kospi || []), ...(sec.kosdaq || [])]) {
      if (s.code && !map.has(s.code)) map.set(s.code, s)
    }
  }
  return map
}

function buildNameList(data: StockData | null): { code: string; name: string }[] {
  const seen = new Set<string>()
  const result: { code: string; name: string }[] = []
  if (!data) return result
  const sections = [data.rising, data.falling, data.volume, data.trading_value]
  for (const sec of sections) {
    if (!sec) continue
    for (const s of [...(sec.kospi || []), ...(sec.kosdaq || [])]) {
      if (s.code && !seen.has(s.code)) {
        seen.add(s.code)
        result.push({ code: s.code, name: s.name })
      }
    }
  }
  // theme analysis stocks
  if (data.theme_analysis?.themes) {
    for (const theme of data.theme_analysis.themes) {
      for (const s of theme.leader_stocks) {
        if (s.code && !seen.has(s.code)) {
          seen.add(s.code)
          result.push({ code: s.code, name: s.name })
        }
      }
    }
  }
  return result
}

// --- Alert thresholds ---
const ALERT_THRESHOLDS = [
  { pct: -10, label: "손절 -10%", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  { pct: -5, label: "손절 -5%", color: "text-red-500 dark:text-red-400", bg: "bg-red-500/5" },
  { pct: 10, label: "익절 +10%", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/5" },
  { pct: 20, label: "익절 +20%", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
]

// --- Component ---

export function PortfolioPage({ stockData, volumeProfileData, themeForecast, history }: PortfolioPageProps) {
  const { user } = useAuth()
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [dbLoading, setDbLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [transactionsByHolding, setTransactionsByHolding] = useState<Record<string, Transaction[]>>({})
  const [calcOpenId, setCalcOpenId] = useState<string | null>(null)
  const [showAvgSheet, setShowAvgSheet] = useState(false)
  const [activeTab, setActiveTab] = useState<"holdings" | "calc">("holdings")
  const [infoPopup, setInfoPopup] = useState<"vwap" | "rvol" | null>(null)

  // ESC 키로 정보 팝업 닫기
  useEffect(() => {
    if (!infoPopup) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setInfoPopup(null) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [infoPopup])

  // Add form state
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStock, setSelectedStock] = useState<{ code: string; name: string } | null>(null)
  const [formAvgPrice, setFormAvgPrice] = useState("")
  const [formQuantity, setFormQuantity] = useState("")

  // Edit form state
  const [editAvgPrice, setEditAvgPrice] = useState("")
  const [editQuantity, setEditQuantity] = useState("")

  // KIS API 실시간 데이터
  const [livePrices, setLivePrices] = useState<Record<string, KisStockPrice>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  // 종목 검색 KIS fallback
  const [kisSearching, setKisSearching] = useState(false)
  const [kisSearchResult, setKisSearchResult] = useState<KisStockPrice | null>(null)

  // 종목 마스터 데이터 (stock-master.json)
  const [masterStocks, setMasterStocks] = useState<{ code: string; name: string; market: string }[]>([])

  const searchInputRef = useRef<HTMLInputElement>(null)

  // 체크 상태 localStorage 키
  const checkedStorageKey = user ? `portfolio-checked-${user.id}` : null

  // Supabase에서 holdings 로드
  useEffect(() => {
    if (!user) { setDbLoading(false); return }
    setDbLoading(true)
    fetchHoldingsFromDB(user.id).then(data => {
      setHoldings(data)
      // localStorage에서 체크 상태 복원, 없으면 전체 선택
      const saved = checkedStorageKey ? localStorage.getItem(checkedStorageKey) : null
      if (saved) {
        try {
          const ids = new Set<string>(JSON.parse(saved))
          // DB에 존재하는 ID만 유지 (삭제된 종목 제거)
          const valid = new Set(data.map(h => h.id).filter(id => ids.has(id)))
          // 신규 추가 종목은 기본 체크
          for (const h of data) {
            if (!ids.has(h.id)) valid.add(h.id)
          }
          setCheckedIds(valid)
        } catch { setCheckedIds(new Set(data.map(h => h.id))) }
      } else {
        setCheckedIds(new Set(data.map(h => h.id)))
      }
      setDbLoading(false)
    })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // 체크 상태 변경 시 localStorage 저장
  useEffect(() => {
    if (!checkedStorageKey || checkedIds.size === 0) return
    localStorage.setItem(checkedStorageKey, JSON.stringify([...checkedIds]))
  }, [checkedIds, checkedStorageKey])

  // 종목 마스터 로드
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/stock-master.json`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.stocks) setMasterStocks(data.stocks)
      })
      .catch(() => {})
  }, [])

  // Stock data maps
  const stockMap = useMemo(() => buildStockMap(stockData), [stockData])
  const nameList = useMemo(() => buildNameList(stockData), [stockData])

  // 통합 종목 리스트 (nameList + masterStocks 병합)
  const mergedNameList = useMemo(() => {
    const seen = new Set<string>()
    const result: { code: string; name: string }[] = []
    // 기존 데이터 우선
    for (const s of nameList) {
      if (!seen.has(s.code)) {
        seen.add(s.code)
        result.push(s)
      }
    }
    // 마스터 데이터 보충
    for (const s of masterStocks) {
      if (!seen.has(s.code)) {
        seen.add(s.code)
        result.push({ code: s.code, name: s.name })
      }
    }
    return result
  }, [nameList, masterStocks])

  // Search autocomplete (통합 리스트 사용)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    return mergedNameList
      .filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q))
      .slice(0, 8)
  }, [searchQuery, mergedNameList])

  // KIS API fallback: 6자리 코드인데 로컬 검색 결과가 없을 때
  const canKisSearch = useMemo(() => {
    const q = searchQuery.trim()
    return /^\d{6}$/.test(q) && searchResults.length === 0 && !selectedStock
  }, [searchQuery, searchResults, selectedStock])

  const handleKisSearch = useCallback(async () => {
    const code = searchQuery.trim()
    if (!code || kisSearching) return
    setKisSearching(true)
    setKisSearchResult(null)
    try {
      const result = await searchKisStock(code)
      setKisSearchResult(result)
    } catch (e) {
      console.error("KIS 검색 실패:", e)
    } finally {
      setKisSearching(false)
    }
  }, [searchQuery, kisSearching])

  // 자동 KIS 검색 트리거 (6자리 코드 입력 후 500ms 대기)
  useEffect(() => {
    if (!canKisSearch) {
      setKisSearchResult(null)
      return
    }
    const timer = setTimeout(handleKisSearch, 500)
    return () => clearTimeout(timer)
  }, [canKisSearch, handleKisSearch])

  // 리프레시: KIS API로 실시간 시세 가져오기
  const handleRefresh = useCallback(async () => {
    if (refreshing || holdings.length === 0) return
    setRefreshing(true)
    try {
      const codes = holdings.map(h => h.code)
      const { prices, failed } = await fetchKisPrices(codes)
      setLivePrices(prices)
      setLastRefreshed(new Date())
      if (failed > 0) {
        alert(`${Object.keys(prices).length}종목 조회 성공, ${failed}종목 실패`)
      }
    } catch (e) {
      console.error("실시간 시세 조회 실패:", e)
      const msg = e instanceof Error ? e.message : ""
      alert(`실시간 시세 조회에 실패했습니다.\n${msg}`)
    } finally {
      setRefreshing(false)
    }
  }, [refreshing, holdings])

  // 포트폴리오 전 종목 진입 시 KIS 실시간 시세 자동 조회
  const [autoFetchingCodes, setAutoFetchingCodes] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (holdings.length === 0) return
    const codes = holdings.map(h => h.code)
    setAutoFetchingCodes(new Set(codes))
    fetchKisPrices(codes).then(({ prices }) => {
      setLivePrices(prev => ({ ...prev, ...prices }))
      setLastRefreshed(new Date())
    }).catch(() => {}).finally(() => {
      setAutoFetchingCodes(new Set())
    })
  }, [holdings]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- CRUD (Supabase) ---
  const addHolding = useCallback(async () => {
    if (!selectedStock || !formAvgPrice || !formQuantity || !user) return
    const avgPrice = parseInt(formAvgPrice.replace(/,/g, ""))
    const quantity = parseInt(formQuantity.replace(/,/g, ""))
    if (isNaN(avgPrice) || isNaN(quantity) || avgPrice <= 0 || quantity <= 0) return

    const { data, error } = await supabase
      .from("portfolio_holdings")
      .insert({
        user_id: user.id,
        code: selectedStock.code,
        name: selectedStock.name,
        avg_price: avgPrice,
        quantity,
      })
      .select()
      .single()

    if (error) {
      alert(error.code === "23505" ? "이미 등록된 종목입니다." : `저장 실패: ${error.message}`)
      return
    }

    setHoldings(prev => [...prev, {
      id: data.id,
      code: data.code,
      name: data.name,
      avgPrice: data.avg_price,
      quantity: data.quantity,
      addedAt: data.added_at,
    }])
    setCheckedIds(prev => new Set([...prev, data.id]))
    setSelectedStock(null)
    setSearchQuery("")
    setFormAvgPrice("")
    setFormQuantity("")
    setShowAddForm(false)
  }, [selectedStock, formAvgPrice, formQuantity, user])

  const deleteHolding = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("portfolio_holdings")
      .delete()
      .eq("id", id)

    if (error) { alert(`삭제 실패: ${error.message}`); return }
    setHoldings(prev => prev.filter(h => h.id !== id))
    setCheckedIds(prev => { const next = new Set(prev); next.delete(id); return next })
    if (expandedId === id) setExpandedId(null)
  }, [expandedId])

  const startEdit = useCallback((h: Holding) => {
    setEditingId(h.id)
    setEditAvgPrice(h.avgPrice.toString())
    setEditQuantity(h.quantity.toString())
  }, [])

  const saveEdit = useCallback(async (id: string) => {
    const avgPrice = parseInt(editAvgPrice.replace(/,/g, ""))
    const quantity = parseInt(editQuantity.replace(/,/g, ""))
    if (isNaN(avgPrice) || isNaN(quantity) || avgPrice <= 0 || quantity <= 0) return

    const { error } = await supabase
      .from("portfolio_holdings")
      .update({ avg_price: avgPrice, quantity, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) { alert(`수정 실패: ${error.message}`); return }
    setHoldings(prev => prev.map(h =>
      h.id === id ? { ...h, avgPrice, quantity } : h
    ))
    setEditingId(null)
  }, [editAvgPrice, editQuantity])

  const applyTransactions = useCallback(async (holdingId: string, newTxs: NewTransaction[]) => {
    if (!user) return
    const holding = holdings.find(h => h.id === holdingId)
    if (!holding) return
    if (newTxs.length === 0) return

    const addCost = newTxs.reduce((sum, t) => sum + t.price * t.quantity, 0)
    const addQty = newTxs.reduce((sum, t) => sum + t.quantity, 0)
    const totalCost = holding.avgPrice * holding.quantity + addCost
    const totalQty = holding.quantity + addQty
    const newAvg = Math.round(totalCost / totalQty)

    const ok = window.confirm(
      `평균단가 ${formatPrice(holding.avgPrice)}원 → ${formatPrice(newAvg)}원\n` +
      `수량 ${holding.quantity.toLocaleString()}주 → ${totalQty.toLocaleString()}주\n\n` +
      `매수 이력에 추가하고 포트폴리오를 갱신합니다. 계속할까요?`
    )
    if (!ok) return

    const rows = newTxs.map(t => ({
      user_id: user.id,
      holding_id: holdingId,
      code: holding.code,
      name: holding.name,
      price: t.price,
      quantity: t.quantity,
      note: t.note,
    }))
    const { data: inserted, error: insertErr } = await supabase
      .from("portfolio_transactions")
      .insert(rows)
      .select()
    if (insertErr || !inserted) {
      alert(`이력 기록 실패: ${insertErr?.message ?? "unknown"}`)
      return
    }

    const { error: updateErr } = await supabase
      .from("portfolio_holdings")
      .update({ avg_price: newAvg, quantity: totalQty, updated_at: new Date().toISOString() })
      .eq("id", holdingId)

    if (updateErr) {
      const ids = inserted.map((r: { id: string }) => r.id)
      await supabase.from("portfolio_transactions").delete().in("id", ids)
      alert(`포트폴리오 갱신 실패: ${updateErr.message}`)
      return
    }

    setHoldings(prev => prev.map(h =>
      h.id === holdingId ? { ...h, avgPrice: newAvg, quantity: totalQty } : h
    ))
    const newTxRecords: Transaction[] = inserted.map((r: {
      id: string; holding_id: string; code: string; name: string;
      price: number; quantity: number; executed_at: string; note: string | null
    }) => ({
      id: r.id,
      holdingId: r.holding_id,
      code: r.code,
      name: r.name,
      price: r.price,
      quantity: r.quantity,
      executedAt: r.executed_at,
      note: r.note,
    }))
    setTransactionsByHolding(prev => ({
      ...prev,
      [holdingId]: [...newTxRecords, ...(prev[holdingId] ?? [])].sort((a, b) =>
        b.executedAt.localeCompare(a.executedAt)
      ),
    }))
  }, [user, holdings])

  const fetchTransactionsForHolding = useCallback(async (holdingId: string) => {
    if (!user) return
    if (transactionsByHolding[holdingId] !== undefined) return

    const { data, error } = await supabase
      .from("portfolio_transactions")
      .select("*")
      .eq("holding_id", holdingId)
      .order("executed_at", { ascending: false })

    if (error) {
      console.warn("transactions fetch error:", error.message)
      return
    }
    const records: Transaction[] = (data ?? []).map(r => ({
      id: r.id,
      holdingId: r.holding_id,
      code: r.code,
      name: r.name,
      price: r.price,
      quantity: r.quantity,
      executedAt: r.executed_at,
      note: r.note,
    }))
    setTransactionsByHolding(prev => ({ ...prev, [holdingId]: records }))
  }, [user, transactionsByHolding])

  // --- Calculations ---

  const enrichedHoldings = useMemo(() => {
    return holdings.map(h => {
      const stock = stockMap.get(h.code)
      const live = livePrices[h.code]
      // KIS 실시간 데이터 우선, 없으면 정적 데이터 폴백
      const currentPrice = live?.current_price ?? stock?.current_price ?? null
      const changeRate = live?.change_rate ?? stock?.change_rate ?? null
      const fundamental = stockData?.fundamental_data?.[h.code] as FundamentalInfo | undefined
      const investorInfo = stockData?.investor_data?.[h.code] as InvestorInfo | undefined

      // 1. 실시간 수익률
      const profitRate = currentPrice ? ((currentPrice - h.avgPrice) / h.avgPrice) * 100 : null
      const profitAmount = currentPrice ? (currentPrice - h.avgPrice) * h.quantity : null
      const evalAmount = currentPrice ? currentPrice * h.quantity : null
      const investAmount = h.avgPrice * h.quantity

      // 2. VWAP / RVOL (실시간)
      let vwap: number | null = null
      let vwapDiffPct: number | null = null
      if (live && live.volume > 0 && live.trading_value > 0) {
        vwap = live.trading_value / live.volume
        if (currentPrice) vwapDiffPct = ((currentPrice - vwap) / vwap) * 100
      }
      let rvol: number | null = null
      const hist = history[h.code]
      const changes = hist?.changes ?? []
      // 어제부터 20영업일 (오늘 분 평균 오염 방지)
      const recent20 = changes.slice(1, 21).map(c => c.volume ?? 0).filter(v => v > 0)
      if (recent20.length > 0 && live) {
        const avgVol = recent20.reduce((a, b) => a + b, 0) / recent20.length
        const elapsed = getMarketElapsedRatio()
        // CLEANUP after 2026-05-31: cutoff 이후 항상 live.volume(UN) 사용.
        const currentVol = Date.now() < RVOL_HISTORY_UN_CUTOFF_MS
          ? (live.krx_volume ?? 0)  // 이전: KRX 단독 (UN 평균과 출처 일치)
          : live.volume              // 이후: UN (UN 평균과 출처 일치)
        if (avgVol > 0 && elapsed !== null && elapsed > 0 && currentVol > 0) {
          rvol = currentVol / (avgVol * elapsed)
        }
      }

      // 3. 손절/익절 알림
      const alerts = profitRate !== null
        ? ALERT_THRESHOLDS.filter(t => t.pct < 0 ? profitRate <= t.pct : profitRate >= t.pct)
        : []

      // 4. 매물대 대비 위치
      let pocPrice: number | null = null
      let pocPosition: string | null = null
      if (volumeProfileData?.profiles?.[h.code]) {
        const vp = volumeProfileData.profiles[h.code]
        // 3m 우선, 없으면 1m
        const period = vp["3m"] || vp["1m"] || vp["6m"]
        if (period) {
          pocPrice = period.poc_price
          if (h.avgPrice > pocPrice) pocPosition = "매물대 상단"
          else if (h.avgPrice < pocPrice) pocPosition = "매물대 하단"
          else pocPosition = "매물대 근접"
        }
      }

      // 5. 52주 대비 위치 (KIS 실시간 데이터 우선)
      let w52Position: number | null = null
      const w52High = live?.w52_hgpr || fundamental?.w52_hgpr || null
      const w52Low = live?.w52_lwpr || fundamental?.w52_lwpr || null
      if (w52High && w52Low) {
        const range = w52High - w52Low
        if (range > 0) {
          w52Position = ((h.avgPrice - w52Low) / range) * 100
        }
      }

      // 6. 외국인 수급
      const foreignNet = investorInfo?.foreign_net ?? null
      const institutionNet = investorInfo?.institution_net ?? null

      // 7. AI 신호 — 현재 테마 분석에서 해당 종목 매칭
      let aiSignal: string | null = null
      if (stockData?.theme_analysis?.themes) {
        for (const theme of stockData.theme_analysis.themes) {
          const match = theme.leader_stocks.find(s => s.code === h.code)
          if (match) {
            aiSignal = `${theme.theme_name} — ${match.reason}`
            break
          }
        }
      }
      // 테마 예측에서도 검색
      let aiForecast: string | null = null
      if (themeForecast?.today) {
        for (const theme of themeForecast.today) {
          const match = theme.leader_stocks.find(s => s.code === h.code)
          if (match) {
            aiForecast = `[오늘] ${theme.theme_name} (${theme.confidence})`
            break
          }
        }
      }

      return {
        ...h,
        currentPrice,
        changeRate,
        profitRate,
        profitAmount,
        evalAmount,
        investAmount,
        vwap,
        vwapDiffPct,
        rvol,
        alerts,
        pocPrice,
        pocPosition,
        w52Position,
        w52High: w52High,
        w52Low: w52Low,
        foreignNet,
        institutionNet,
        aiSignal,
        aiForecast,
      }
    })
  }, [holdings, stockMap, stockData, volumeProfileData, themeForecast, livePrices, history])

  // 2. 포트폴리오 총 손익 (체크된 종목만)
  const summary = useMemo(() => {
    let totalInvest = 0
    let totalEval = 0
    let priceAvailable = 0

    for (const h of enrichedHoldings) {
      if (!checkedIds.has(h.id)) continue
      totalInvest += h.investAmount
      if (h.evalAmount !== null) {
        totalEval += h.evalAmount
        priceAvailable++
      }
    }

    const totalProfit = totalEval - totalInvest
    const totalProfitRate = totalInvest > 0 ? (totalProfit / totalInvest) * 100 : 0
    const checkedCount = enrichedHoldings.filter(h => checkedIds.has(h.id)).length

    return { totalInvest, totalEval, totalProfit, totalProfitRate, priceAvailable, totalCount: enrichedHoldings.length, checkedCount }
  }, [enrichedHoldings, checkedIds])

  // Focus search on form open
  useEffect(() => {
    if (showAddForm) searchInputRef.current?.focus()
  }, [showAddForm])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Briefcase className="w-5 h-5 text-primary shrink-0" />
          <h2 className="text-lg font-bold whitespace-nowrap">내 포트폴리오</h2>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{holdings.length}종목</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {lastRefreshed && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 whitespace-nowrap leading-tight text-center">
              <span className="block font-semibold">LIVE</span>
              <span className="block">{lastRefreshed.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
            </span>
          )}
          {holdings.length > 0 && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="KIS API 실시간 시세 조회"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              showAddForm
                ? "bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? "취소" : "추가"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        <button
          onClick={() => setActiveTab("holdings")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            activeTab === "holdings" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >내 보유</button>
        <button
          onClick={() => setActiveTab("calc")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            activeTab === "calc" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >가상 계산기</button>
      </div>

      {activeTab === "calc" && <PaperCalcTab masterStocks={masterStocks} />}

      {activeTab === "holdings" && <>
      {/* Add Form */}
      {showAddForm && (
        <Card className="border-primary/30">
          <CardContent className="p-3 sm:p-4 space-y-3">
            {/* Stock search */}
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={selectedStock ? `${selectedStock.name} (${selectedStock.code})` : searchQuery}
                onChange={e => {
                  if (selectedStock) setSelectedStock(null)
                  setSearchQuery(e.target.value)
                }}
                placeholder="종목명 또는 코드 검색"
                className="w-full px-3 py-2 rounded-lg border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {searchResults.length > 0 && !selectedStock && (
                <div className="absolute z-20 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map(s => (
                    <button
                      key={s.code}
                      onClick={() => {
                        setSelectedStock(s)
                        setSearchQuery("")
                        setKisSearchResult(null)
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground text-xs">{s.code}</span>
                    </button>
                  ))}
                </div>
              )}
              {/* 검색 결과 없음 + KIS 안내 */}
              {!selectedStock && searchQuery.trim().length > 0 && searchResults.length === 0 && !canKisSearch && !kisSearching && (
                <div className="absolute z-20 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg">
                  <div className="px-3 py-3 text-xs text-muted-foreground text-center space-y-1">
                    <p>검색 결과가 없습니다</p>
                    <p className="text-muted-foreground/60">종목 코드 6자리 입력 시 KIS API로 실시간 조회합니다</p>
                  </div>
                </div>
              )}
              {/* KIS API fallback 검색 결과 */}
              {!selectedStock && canKisSearch && (
                <div className="absolute z-20 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg">
                  {kisSearching && (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      KIS API에서 종목 조회 중...
                    </div>
                  )}
                  {!kisSearching && kisSearchResult && (
                    <button
                      onClick={() => {
                        setSelectedStock({ code: kisSearchResult.code, name: kisSearchResult.name })
                        setSearchQuery("")
                        setKisSearchResult(null)
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Search className="w-3 h-3 text-emerald-500" />
                        <span className="font-medium">{kisSearchResult.name}</span>
                        <span className="text-muted-foreground text-xs">{kisSearchResult.code}</span>
                      </div>
                      <span className={cn(
                        "text-xs font-semibold tabular-nums",
                        kisSearchResult.change_rate >= 0 ? "text-red-500" : "text-blue-500"
                      )}>
                        {formatPrice(kisSearchResult.current_price)}원
                      </span>
                    </button>
                  )}
                  {!kisSearching && !kisSearchResult && (
                    <div className="px-3 py-3 text-xs text-muted-foreground/50 text-center">
                      KIS API 조회 결과 없음
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Price & Quantity */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">평균단가 (원)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formAvgPrice}
                  onChange={e => setFormAvgPrice(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="예: 50000"
                  className="w-full px-3 py-2 rounded-lg border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">수량 (주)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formQuantity}
                  onChange={e => setFormQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="예: 100"
                  className="w-full px-3 py-2 rounded-lg border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <button
              onClick={addHolding}
              disabled={!selectedStock || !formAvgPrice || !formQuantity}
              className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              추가
            </button>
          </CardContent>
        </Card>
      )}

      {/* Portfolio Summary */}
      {holdings.length > 0 && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] text-muted-foreground tracking-wide">
                {checkedIds.size === enrichedHoldings.length
                  ? `${summary.totalCount}종목 합산`
                  : `${summary.checkedCount}/${summary.totalCount}종목 합산`}
              </span>
              <button
                onClick={() => {
                  const allIds = enrichedHoldings.map(h => h.id)
                  setCheckedIds(prev => prev.size === allIds.length ? new Set() : new Set(allIds))
                }}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 decoration-muted-foreground/30"
              >
                {checkedIds.size === enrichedHoldings.length ? "전체 해제" : "전체 선택"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] text-muted-foreground">총 투자금</div>
                <div className="text-sm font-bold">{formatPrice(summary.totalInvest)}원</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">총 평가금</div>
                <div className="text-sm font-bold">
                  {summary.priceAvailable > 0 ? `${formatPrice(Math.round(summary.totalEval))}원` : "-"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">총 손익</div>
                <div className={cn("text-sm font-bold", summary.totalProfit >= 0 ? "text-red-500" : "text-blue-500")}>
                  {summary.priceAvailable > 0
                    ? `${summary.totalProfit >= 0 ? "+" : ""}${formatPrice(Math.round(summary.totalProfit))}원`
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">총 수익률</div>
                <div className={cn("text-sm font-bold", summary.totalProfitRate >= 0 ? "text-red-500" : "text-blue-500")}>
                  {summary.priceAvailable > 0
                    ? `${summary.totalProfitRate >= 0 ? "+" : ""}${summary.totalProfitRate.toFixed(2)}%`
                    : "-"}
                </div>
              </div>
            </div>
            {/* 물타기 시뮬레이션 버튼 */}
            <button
              onClick={() => setShowAvgSheet(true)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <Calculator className="w-3.5 h-3.5" />
              물타기 시뮬레이션
            </button>
          </CardContent>
        </Card>
      )}

      {/* Holdings List */}
      {dbLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
          <p className="text-sm">포트폴리오 로딩 중...</p>
        </div>
      )}

      {!dbLoading && enrichedHoldings.length === 0 && !showAddForm && (
        <div className="text-center py-12 text-muted-foreground">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">보유 종목이 없습니다</p>
          <p className="text-xs mt-1">종목 추가 버튼으로 포트폴리오를 구성하세요</p>
        </div>
      )}

      <div className="space-y-2">
        {enrichedHoldings.map(h => {
          const isEditing = editingId === h.id
          const isExpanded = expandedId === h.id
          const hasAlert = h.alerts.length > 0

          return (
            <Card
              key={h.id}
              className={cn(
                "transition-all duration-300 relative overflow-hidden",
                hasAlert && "border-orange-500/30",
                !checkedIds.has(h.id) && "opacity-40 grayscale-[30%]"
              )}
            >
              <CardContent className="p-3 sm:p-4">
                {/* Main row */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setCheckedIds(prev => {
                      const next = new Set(prev)
                      next.has(h.id) ? next.delete(h.id) : next.add(h.id)
                      return next
                    })}
                    className="shrink-0 -ml-0.5 mr-0.5"
                    aria-label={checkedIds.has(h.id) ? "합산에서 제외" : "합산에 포함"}
                  >
                    <span className={cn(
                      "w-4 h-4 rounded-[5px] flex items-center justify-center transition-all duration-200 border",
                      checkedIds.has(h.id)
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/25 hover:border-muted-foreground/50"
                    )}>
                      {checkedIds.has(h.id) && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      const newExpanded = isExpanded ? null : h.id
                      setExpandedId(newExpanded)
                      if (newExpanded) fetchTransactionsForHolding(newExpanded)
                    }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{h.name}</span>
                      <span className="text-[10px] text-muted-foreground">{h.code}</span>
                      {hasAlert && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                      {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />}
                    </div>
                  </button>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* 실시간 수익률 */}
                    <div className="text-right">
                      {h.currentPrice !== null ? (
                        <>
                          <div className="flex items-center justify-end gap-1">
                            {livePrices[h.code] && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="실시간" />}
                            <span className="text-xs text-muted-foreground">{formatPrice(h.currentPrice)}원</span>
                          </div>
                          <div className={cn("text-sm font-bold tabular-nums", (h.profitRate ?? 0) >= 0 ? "text-red-500" : "text-blue-500")}>
                            {h.profitRate !== null ? `${h.profitRate >= 0 ? "+" : ""}${h.profitRate.toFixed(2)}%` : "-"}
                          </div>
                        </>
                      ) : autoFetchingCodes.has(h.code) ? (
                        <span className="text-xs text-muted-foreground animate-pulse">조회 중...</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">가격 없음</span>
                      )}
                    </div>

                    {/* Actions */}
                    {!isEditing && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(h)} className="p-1 rounded hover:bg-muted transition-colors" title="수정">
                          <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => deleteHolding(h.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors" title="삭제">
                          <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit row */}
                {isEditing && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground">평균단가</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editAvgPrice}
                        onChange={e => setEditAvgPrice(e.target.value.replace(/[^0-9]/g, ""))}
                        className="w-full px-2 py-1 rounded border bg-background text-base focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground">수량</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editQuantity}
                        onChange={e => setEditQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                        className="w-full px-2 py-1 rounded border bg-background text-base focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div className="flex items-center gap-1 pt-3">
                      <button onClick={() => saveEdit(h.id)} className="p-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors">
                        <Check className="w-4 h-4 text-primary" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-muted transition-colors">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Compact info row */}
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                  <span>매수가 {formatPrice(h.avgPrice)}원</span>
                  <span>{h.quantity}주</span>
                  <span>투자금 {formatPrice(h.investAmount)}원</span>
                  {h.profitAmount !== null && (
                    <span className={cn("font-medium", h.profitAmount >= 0 ? "text-red-500" : "text-blue-500")}>
                      {h.profitAmount >= 0 ? "+" : ""}{formatPrice(Math.round(h.profitAmount))}원
                    </span>
                  )}
                </div>

                {/* Live VWAP / RVOL row */}
                {(h.vwap !== null || h.rvol !== null) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                    {h.vwap !== null && (
                      <span className="inline-flex items-center gap-0.5">
                        <button
                          onClick={() => setInfoPopup("vwap")}
                          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                          aria-label="VWAP 설명 보기"
                        >
                          VWAP
                          <HelpCircle className="w-2.5 h-2.5 opacity-60" />
                        </button>{" "}
                        <span className="font-medium text-foreground/85 tabular-nums">{formatPrice(Math.round(h.vwap))}원</span>
                        {h.vwapDiffPct !== null && (
                          <span className={cn("ml-1 font-medium tabular-nums", h.vwapDiffPct >= 0 ? "text-red-500" : "text-blue-500")}>
                            ({h.vwapDiffPct >= 0 ? "+" : ""}{h.vwapDiffPct.toFixed(2)}%)
                          </span>
                        )}
                      </span>
                    )}
                    {h.rvol !== null && (
                      <span className="inline-flex items-center gap-0.5">
                        <button
                          onClick={() => setInfoPopup("rvol")}
                          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                          aria-label="RVOL 설명 보기"
                        >
                          RVOL
                          <HelpCircle className="w-2.5 h-2.5 opacity-60" />
                        </button>{" "}
                        <span
                          className={cn(
                            "font-medium tabular-nums",
                            h.rvol >= 2 ? "text-red-500" : h.rvol >= 1.2 ? "text-amber-500" : "text-foreground/85",
                          )}
                        >
                          {h.rvol.toFixed(2)}x
                        </span>
                      </span>
                    )}
                  </div>
                )}

                {/* Alert badges */}
                {hasAlert && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {h.alerts.map(a => (
                      <span key={a.pct} className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", a.bg, a.color)}>
                        {a.label} 도달
                      </span>
                    ))}
                  </div>
                )}

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t space-y-2.5">
                    {/* 4. 매물대 대비 위치 */}
                    <DetailRow label="매물대 대비 위치" icon={<TrendingUp className="w-3 h-3" />}>
                      {h.pocPrice !== null ? (
                        <span>
                          POC {formatPrice(h.pocPrice)}원 —{" "}
                          <span className={cn("font-medium", h.pocPosition === "매물대 하단" ? "text-emerald-600 dark:text-emerald-400" : h.pocPosition === "매물대 상단" ? "text-orange-600 dark:text-orange-400" : "text-foreground")}>
                            {h.pocPosition}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">매물대 데이터 없음</span>
                      )}
                    </DetailRow>

                    {/* 5. 52주 대비 위치 */}
                    <DetailRow label="52주 대비 매수 위치" icon={<TrendingDown className="w-3 h-3" />}>
                      {h.w52Position !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative">
                            <div
                              className="absolute top-0 left-0 h-full bg-primary/60 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, h.w52Position))}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold tabular-nums shrink-0">{h.w52Position.toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">데이터 없음</span>
                      )}
                      {h.w52Low !== null && h.w52High !== null && (
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                          <span>52주저 {formatPrice(h.w52Low)}원</span>
                          <span>52주고 {formatPrice(h.w52High)}원</span>
                        </div>
                      )}
                    </DetailRow>

                    {/* 6. 외국인 수급 대비 */}
                    <DetailRow label="외국인/기관 수급" icon={<Briefcase className="w-3 h-3" />}>
                      {h.foreignNet !== null ? (
                        <div className="flex items-center gap-3">
                          <span className="text-xs">
                            외국인{" "}
                            <span className={cn("font-bold", h.foreignNet >= 0 ? "text-red-500" : "text-blue-500")}>
                              {h.foreignNet >= 0 ? "+" : ""}{(h.foreignNet / 1000).toFixed(0)}천주
                            </span>
                          </span>
                          {h.institutionNet !== null && (
                            <span className="text-xs">
                              기관{" "}
                              <span className={cn("font-bold", h.institutionNet >= 0 ? "text-red-500" : "text-blue-500")}>
                                {h.institutionNet >= 0 ? "+" : ""}{(h.institutionNet / 1000).toFixed(0)}천주
                              </span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">수급 데이터 없음</span>
                      )}
                    </DetailRow>

                    {/* 7. AI 신호 대비 */}
                    <DetailRow label="AI 분석 신호" icon={<TrendingUp className="w-3 h-3" />}>
                      {h.aiSignal ? (
                        <span className="text-xs">{h.aiSignal}</span>
                      ) : h.aiForecast ? (
                        <span className="text-xs text-amber-600 dark:text-amber-400">{h.aiForecast}</span>
                      ) : (
                        <span className="text-muted-foreground">현재 AI 분석에 미포함</span>
                      )}
                    </DetailRow>

                    {/* 매수 이력 */}
                    <DetailRow label="매수 이력" icon={<History className="w-3 h-3" />}>
                      {(() => {
                        const txs = transactionsByHolding[h.id]
                        if (txs === undefined) return <span className="text-muted-foreground text-xs">불러오는 중...</span>
                        if (txs.length === 0) return <span className="text-muted-foreground text-xs">추가 매수 이력 없음</span>
                        return (
                          <ul className="space-y-1 w-full">
                            {txs.map(tx => (
                              <li key={tx.id} className="flex justify-between items-baseline text-xs">
                                <span className="text-muted-foreground tabular-nums">
                                  {new Date(tx.executedAt).toLocaleDateString("ko-KR", {
                                    year: "2-digit", month: "2-digit", day: "2-digit"
                                  })}
                                </span>
                                <span className="tabular-nums text-right">
                                  <span className="font-medium">{formatPrice(tx.price)}</span>원 ×{" "}
                                  <span className="font-medium">{tx.quantity.toLocaleString()}</span>주
                                  {tx.note && (
                                    <span className="text-muted-foreground/60 ml-1.5 text-[10px]">{tx.note}</span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )
                      })()}
                    </DetailRow>

                    {/* Naver link + 물타기 버튼 */}
                    <div className="flex items-center gap-3">
                      <a
                        href={`https://www.tossinvest.com/stocks/A${h.code}/order`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        네이버 증권
                      </a>
                      <button
                        onClick={() => setCalcOpenId(calcOpenId === h.id ? null : h.id)}
                        className={cn(
                          "inline-flex items-center gap-1 text-[11px] font-medium transition-colors",
                          calcOpenId === h.id ? "text-primary" : "text-muted-foreground hover:text-primary"
                        )}
                      >
                        <Calculator className="w-3 h-3" />
                        물타기 계산
                      </button>
                    </div>

                    {/* 인라인 물타기 계산기 */}
                    {calcOpenId === h.id && (
                      <AveragingDownCalc
                        holding={{
                          id: h.id,
                          code: h.code,
                          name: h.name,
                          avgPrice: h.avgPrice,
                          quantity: h.quantity,
                          currentPrice: h.currentPrice,
                        }}
                        onApply={(txs) => applyTransactions(h.id, txs)}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
      {/* 물타기 시뮬레이션 Bottom Sheet */}
      {showAvgSheet && (
        <AveragingDownSheet
          holdings={enrichedHoldings.filter(h => checkedIds.has(h.id)).map(h => ({
            id: h.id,
            code: h.code,
            name: h.name,
            avgPrice: h.avgPrice,
            quantity: h.quantity,
            currentPrice: h.currentPrice,
          }))}
          onClose={() => setShowAvgSheet(false)}
          onApply={applyTransactions}
        />
      )}
      </>}

      {/* VWAP / RVOL 설명 팝업 */}
      {infoPopup && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setInfoPopup(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40">
              <h3 className="text-base font-bold text-foreground">
                {infoPopup === "vwap" ? "VWAP — 거래량 가중 평균가" : "RVOL — 상대 거래량"}
              </h3>
              <button
                onClick={() => setInfoPopup(null)}
                className="text-muted-foreground hover:text-foreground p-1 -mr-1 transition-colors"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 text-sm text-foreground/90 space-y-3">
              {infoPopup === "vwap" ? <VwapHelp /> : <RvolHelp />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function DetailRow({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-xs">{children}</div>
    </div>
  )
}
