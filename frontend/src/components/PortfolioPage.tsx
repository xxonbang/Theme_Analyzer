import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Plus, Trash2, Edit3, Check, X, TrendingUp, TrendingDown,
  AlertTriangle, Briefcase, ExternalLink, ChevronDown, ChevronUp,
  RefreshCw, Search, Loader2,
} from "lucide-react"
import { cn, formatPrice } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { fetchKisPrices, searchKisStock, type KisStockPrice } from "@/lib/kis-api"
import type {
  StockData, FundamentalInfo, InvestorInfo, VolumeProfileData,
  ThemeForecast, Stock,
} from "@/types/stock"

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
}

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

export function PortfolioPage({ stockData, volumeProfileData, themeForecast }: PortfolioPageProps) {
  const { user } = useAuth()
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [dbLoading, setDbLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  // Supabase에서 holdings 로드
  useEffect(() => {
    if (!user) { setDbLoading(false); return }
    setDbLoading(true)
    fetchHoldingsFromDB(user.id).then(data => {
      setHoldings(data)
      setDbLoading(false)
    })
  }, [user])

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
      const prices = await fetchKisPrices(codes)
      setLivePrices(prices)
      setLastRefreshed(new Date())
    } catch (e) {
      console.error("실시간 시세 조회 실패:", e)
      alert("실시간 시세 조회에 실패했습니다. 잠시 후 다시 시도해주세요.")
    } finally {
      setRefreshing(false)
    }
  }, [refreshing, holdings])

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
  }, [holdings, stockMap, stockData, volumeProfileData, themeForecast, livePrices])

  // 2. 포트폴리오 총 손익
  const summary = useMemo(() => {
    let totalInvest = 0
    let totalEval = 0
    let priceAvailable = 0

    for (const h of enrichedHoldings) {
      totalInvest += h.investAmount
      if (h.evalAmount !== null) {
        totalEval += h.evalAmount
        priceAvailable++
      }
    }

    const totalProfit = totalEval - totalInvest
    const totalProfitRate = totalInvest > 0 ? (totalProfit / totalInvest) * 100 : 0

    return { totalInvest, totalEval, totalProfit, totalProfitRate, priceAvailable, totalCount: enrichedHoldings.length }
  }, [enrichedHoldings])

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
                "transition-colors",
                hasAlert && "border-orange-500/30"
              )}
            >
              <CardContent className="p-3 sm:p-4">
                {/* Main row */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : h.id)}
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
                      <label className="text-[9px] text-muted-foreground">평균단가</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editAvgPrice}
                        onChange={e => setEditAvgPrice(e.target.value.replace(/[^0-9]/g, ""))}
                        className="w-full px-2 py-1 rounded border bg-background text-base focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-muted-foreground">수량</label>
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
                        <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
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

                    {/* Naver link */}
                    <a
                      href={`https://m.stock.naver.com/domestic/stock/${h.code}/total`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      네이버 증권에서 보기
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
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
