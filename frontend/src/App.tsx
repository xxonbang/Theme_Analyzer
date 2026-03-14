import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Header } from "@/components/Header"
import { ExchangeRate } from "@/components/ExchangeRate"
import { AIThemeAnalysis } from "@/components/AIThemeAnalysis"
import { StockList } from "@/components/StockList"
import { TabBar } from "@/components/TabBar"
import { HistoryModal } from "@/components/HistoryModal"
import { PaperTradingPage } from "@/components/PaperTradingPage"
import { ThemeForecastPage } from "@/components/ThemeForecastPage"
import { AuthPage } from "@/components/AuthPage"
import { CriteriaLegend } from "@/components/CriteriaLegend"
import { IndexAlertSection } from "@/components/KosdaqIndexAlert"
import { ApiKeyAlertBanner } from "@/components/ApiKeyAlertBanner"
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator"
import { useApiAlerts } from "@/hooks/useApiAlerts"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"
import { useStockData } from "@/hooks/useStockData"
import { useHistoryData } from "@/hooks/useHistoryData"
import { useAuth } from "@/hooks/useAuth"
import { useThemeMode } from "@/hooks/useThemeMode"
import { useVolumeProfile } from "@/hooks/useVolumeProfile"
import { useIntradayHistory } from "@/hooks/useIntradayHistory"
import { useMacroIndicators } from "@/hooks/useMacroIndicators"
import { useIndicatorHistory } from "@/hooks/useIndicatorHistory"
import { useInvestorIntraday } from "@/hooks/useInvestorIntraday"
import { MacroIndicators } from "@/components/MacroIndicators"
import { Loader2, ArrowLeft, Calendar, Clock, ChevronUp, Search, X } from "lucide-react"
import { cn, getWeekday } from "@/lib/utils"
import type { HistoryEntry } from "@/types/history"
import type { TabType, FluctuationMode, CompositeMode, Stock } from "@/types/stock"

type PageType = "home" | "paper-trading" | "theme-forecast"

const TAB_LABELS: Record<string, string> = {
  composite: "종합",
  trading_value: "거래대금",
  volume: "거래량",
  fluctuation: "등락률",
}

function StockSearchPanel({ stocks, onSelect, onClose }: {
  stocks: Array<Stock & { tabs: TabType[] }>
  onSelect: (code: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  const filtered = useMemo(() => {
    if (!query.trim()) return []
    const q = query.trim().toLowerCase()
    return stocks.filter(s =>
      s.name.toLowerCase().includes(q) || s.code.includes(q)
    ).slice(0, 20)
  }, [query, stocks])

  return (
    <div className="sticky top-14 sm:top-16 z-[45] bg-card border-b border-border shadow-md">
      <div className="container px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="종목명 또는 코드 검색..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs font-medium px-1.5 py-0.5 rounded hover:bg-muted transition-colors">
            닫기
          </button>
        </div>
        {filtered.length > 0 && (
          <div className="mt-2 max-h-64 overflow-y-auto border-t border-border/30 pt-1">
            {filtered.map(s => {
              const isUp = s.change_rate > 0
              const isDown = s.change_rate < 0
              return (
                <button
                  key={s.code}
                  onClick={() => onSelect(s.code)}
                  className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-muted/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">{s.code}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      "text-xs font-semibold tabular-nums",
                      isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-foreground/70"
                    )}>
                      {isUp ? "+" : ""}{s.change_rate.toFixed(2)}%
                    </span>
                    <div className="flex gap-0.5">
                      {s.tabs.slice(0, 2).map(t => (
                        <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground/70">{TAB_LABELS[t]}</span>
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
        {query.trim() && filtered.length === 0 && (
          <p className="text-xs text-muted-foreground/50 text-center py-3">검색 결과 없음</p>
        )}
      </div>
    </div>
  )
}

// 로컬 스토리지 키
const COMPACT_MODE_KEY = "stock-dashboard-compact-mode"
const ACTIVE_TAB_KEY = "stock-dashboard-active-tab"
const FLUCTUATION_MODE_KEY = "stock-dashboard-fluctuation-mode"
const COMPOSITE_MODE_KEY = "stock-dashboard-composite-mode"

function App() {
  const { user, loading: authLoading, isAdmin, recordVisit, logActivity } = useAuth()
  const { toggle: toggleTheme, isDark } = useThemeMode()
  const { data: vpData } = useVolumeProfile()
  const { data: intradayHistoryData } = useIntradayHistory()
  const { data: macroData } = useMacroIndicators()
  const { data: indicatorHistory, loading: indicatorHistoryLoading, fetchHistory: fetchIndicatorHistory } = useIndicatorHistory()
  const { data: investorIntradayData } = useInvestorIntraday()
  const [currentPage, setCurrentPage] = useState<PageType>("home")

  // 페이지 전환/접속 시 이력 기록
  useEffect(() => {
    recordVisit()
    logActivity("page_view", { page: currentPage })
  }, [currentPage, recordVisit, logActivity])
  const apiAlerts = useApiAlerts(isAdmin)
  const { data: currentData, loading, error, refetch, refreshFromAPI, cancelRefresh, refreshElapsed } = useStockData()
  const { containerRef, pullDistance, isRefreshing, canRelease } = usePullToRefresh({
    onRefresh: refetch,
    enabled: !loading,
  })
  const {
    groupedHistory,
    selectedData: historyData,
    selectedEntry,
    loading: historyLoading,
    error: historyError,
    fetchIndex,
    fetchHistoryData,
    clearSelection,
  } = useHistoryData()

  // 히스토리 모달 상태
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  // 종목 검색 상태
  const [searchOpen, setSearchOpen] = useState(false)

  // 컴팩트 모드 상태 (로컬 스토리지에서 복원)
  const [compactMode, setCompactMode] = useState(() => {
    const saved = localStorage.getItem(COMPACT_MODE_KEY)
    return saved === "true"
  })

  // 탭 상태 (로컬 스토리지에서 복원)
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY)
    return (saved as TabType) || "composite"
  })

  // 등락률 모드 상태 (로컬 스토리지에서 복원)
  const [fluctuationMode, setFluctuationMode] = useState<FluctuationMode>(() => {
    const saved = localStorage.getItem(FLUCTUATION_MODE_KEY)
    return (saved as FluctuationMode) || "calculated"
  })

  // 종합 탭 구성 방식
  const [compositeMode, setCompositeMode] = useState<CompositeMode>(() => {
    const saved = localStorage.getItem(COMPOSITE_MODE_KEY)
    if (saved === "all" || saved === "trading_volume" || saved === "trading_fluc" || saved === "volume_fluc") return saved
    return "trading_fluc"
  })

  // 컴팩트 모드 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    localStorage.setItem(COMPACT_MODE_KEY, String(compactMode))
  }, [compactMode])

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_KEY, activeTab)
  }, [activeTab])

  useEffect(() => {
    localStorage.setItem(FLUCTUATION_MODE_KEY, fluctuationMode)
  }, [fluctuationMode])

  useEffect(() => {
    localStorage.setItem(COMPOSITE_MODE_KEY, compositeMode)
  }, [compositeMode])

  // Scroll to top 버튼 + 헤더 숨김 상태
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [headerHidden, setHeaderHidden] = useState(false)
  const lastScrollY = useRef(0)
  const stickyBarRef = useRef<HTMLDivElement>(null)
  const collapsibleRef = useRef<HTMLDivElement>(null)
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null)

  const scrollCooldown = useRef(0)
  useEffect(() => {
    const SCROLL_DEADZONE = 8
    const COOLDOWN_MS = 350 // 트랜지션 완료까지 스크롤 이벤트 무시
    const handleScroll = () => {
      const currentY = window.scrollY
      setShowScrollTop(currentY > 300)
      if (Date.now() < scrollCooldown.current) {
        lastScrollY.current = currentY
        return
      }
      const delta = currentY - lastScrollY.current
      if (delta > SCROLL_DEADZONE && currentY > 80) {
        setHeaderHidden(true)
        scrollCooldown.current = Date.now() + COOLDOWN_MS
        lastScrollY.current = currentY
      } else if (delta < -SCROLL_DEADZONE) {
        setHeaderHidden(false)
        scrollCooldown.current = Date.now() + COOLDOWN_MS
        lastScrollY.current = currentY
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])



  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  // scrollToStock는 stockTabMap 이후에 정의 (아래 참조)

  const toggleCompactMode = () => {
    setCompactMode((prev) => !prev)
  }

  // 현재 데이터 or 히스토리 데이터 표시
  const displayData = historyData || currentData
  const isViewingHistory = !!historyData

  // 신규 JSON 여부 (volume 필드가 있으면 신규)
  const hasNewFields = !!displayData?.volume

  // 등락률 모드에 따른 활성 등락률 데이터
  const activeFluctuationData = useMemo(() => {
    if (!displayData) return null
    if (hasNewFields) {
      return fluctuationMode === "direct"
        ? displayData.fluctuation_direct || displayData.fluctuation
        : displayData.fluctuation
    }
    // 이전 JSON 폴백: rising/falling에서 등락률 데이터 합성
    return {
      kospi_up: displayData.rising.kospi,
      kospi_down: displayData.falling.kospi,
      kosdaq_up: displayData.rising.kosdaq,
      kosdaq_down: displayData.falling.kosdaq,
    }
  }, [displayData, fluctuationMode, hasNewFields])

  // 거래량 탭 폴백 데이터
  const volumeTabData = useMemo(() => {
    if (!displayData) return null
    if (hasNewFields) {
      return displayData.volume!
    }
    // 이전 JSON 폴백: rising+falling 합쳐서 거래량순 정렬
    const kospiAll = [...displayData.rising.kospi, ...displayData.falling.kospi]
      .sort((a, b) => b.volume - a.volume)
      .map((s, i) => ({ ...s, rank: i + 1 }))
    const kosdaqAll = [...displayData.rising.kosdaq, ...displayData.falling.kosdaq]
      .sort((a, b) => b.volume - a.volume)
      .map((s, i) => ({ ...s, rank: i + 1 }))
    return { kospi: kospiAll, kosdaq: kosdaqAll }
  }, [displayData, hasNewFields])

  // 거래대금 탭 폴백 데이터
  const tradingValueTabData = useMemo(() => {
    if (!displayData) return null
    if (hasNewFields) {
      return displayData.trading_value!
    }
    // 이전 JSON 폴백: rising+falling 합쳐서 거래대금(또는 거래량)순 정렬
    const kospiAll = [...displayData.rising.kospi, ...displayData.falling.kospi]
      .sort((a, b) => (b.trading_value || b.volume) - (a.trading_value || a.volume))
      .map((s, i) => ({ ...s, rank: i + 1 }))
    const kosdaqAll = [...displayData.rising.kosdaq, ...displayData.falling.kosdaq]
      .sort((a, b) => (b.trading_value || b.volume) - (a.trading_value || a.volume))
      .map((s, i) => ({ ...s, rank: i + 1 }))
    return { kospi: kospiAll, kosdaq: kosdaqAll }
  }, [displayData, hasNewFields])

  // 종합 탭: compositeMode에 따른 가중 점수 합산
  const compositeData = useMemo(() => {
    if (!displayData) return null
    if (!hasNewFields) return null // 이전 JSON이면 null → 폴백

    const weights: Record<string, { tv: number; vol: number; fluc: number }> = {
      trading_fluc: { tv: 5, vol: 0, fluc: 1 },
      volume_fluc: { tv: 0, vol: 1.5, fluc: 1.5 },
      all: { tv: 1, vol: 1, fluc: 1 },
      trading_volume: { tv: 1.5, vol: 1.5, fluc: 0 },
    }
    const w = weights[compositeMode]

    // 코스피/코스닥 각각에 대해 점수 계산
    const calcScored = (
      tradingList: Stock[],
      volumeList: Stock[],
      flucUpList: Stock[],
      flucDownList: Stock[],
    ) => {
      // 순위 맵 생성
      const tradingRankMap = new Map<string, number>()
      tradingList.forEach((s, i) => tradingRankMap.set(s.code, i + 1))

      const volumeRankMap = new Map<string, number>()
      volumeList.forEach((s, i) => volumeRankMap.set(s.code, i + 1))

      const flucRankMap = new Map<string, number>()
      ;[...flucUpList, ...flucDownList].forEach((s, i) => flucRankMap.set(s.code, i + 1))

      // 전체 종목 합집합
      const allCodes = new Set([
        ...tradingRankMap.keys(),
        ...volumeRankMap.keys(),
        ...flucRankMap.keys(),
      ])

      // 점수 계산 + 정렬
      const scored = [...allCodes].map(code => {
        const tvScore = tradingRankMap.has(code) ? (31 - tradingRankMap.get(code)!) * w.tv : 0
        const volScore = volumeRankMap.has(code) ? (31 - volumeRankMap.get(code)!) * w.vol : 0
        const flucScore = flucRankMap.has(code) ? (31 - flucRankMap.get(code)!) * w.fluc : 0
        return { code, score: tvScore + volScore + flucScore }
      }).filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)

      // code → Stock 맵
      const stockMap = new Map<string, Stock>()
      ;[...tradingList, ...volumeList, ...flucUpList, ...flucDownList]
        .forEach(s => { if (!stockMap.has(s.code)) stockMap.set(s.code, s) })

      return scored
        .filter(item => stockMap.has(item.code))
        .map((item, i) => ({ ...stockMap.get(item.code)!, rank: i + 1 }))
    }

    const kospiRanked = calcScored(
      displayData.trading_value?.kospi || [],
      displayData.volume?.kospi || [],
      activeFluctuationData?.kospi_up || [],
      activeFluctuationData?.kospi_down || [],
    )
    const kosdaqRanked = calcScored(
      displayData.trading_value?.kosdaq || [],
      displayData.volume?.kosdaq || [],
      activeFluctuationData?.kosdaq_up || [],
      activeFluctuationData?.kosdaq_down || [],
    )

    // 상승/하락 분리
    let rank = 0
    const kospiUp = kospiRanked.filter((s: Stock) => s.change_rate > 0).map((s: Stock) => ({ ...s, rank: ++rank }))
    rank = 0
    const kospiDown = kospiRanked.filter((s: Stock) => s.change_rate < 0).map((s: Stock) => ({ ...s, rank: ++rank }))
    rank = 0
    const kosdaqUp = kosdaqRanked.filter((s: Stock) => s.change_rate > 0).map((s: Stock) => ({ ...s, rank: ++rank }))
    rank = 0
    const kosdaqDown = kosdaqRanked.filter((s: Stock) => s.change_rate < 0).map((s: Stock) => ({ ...s, rank: ++rank }))

    return {
      rising: { kospi: kospiUp, kosdaq: kosdaqUp },
      falling: { kospi: kospiDown, kosdaq: kosdaqDown },
    }
  }, [displayData, activeFluctuationData, hasNewFields, compositeMode])

  // 종합 탭 타이틀 (교집합 조건 반영)
  const compositeTitle = useMemo(() => {
    if (compositeMode === "all") return "거래대금 + 거래량"
    if (compositeMode === "trading_volume") return "거래대금 + 거래량"
    if (compositeMode === "trading_fluc") return "거래대금"
    return "거래량"
  }, [compositeMode])

  // 종목코드 → 포함된 탭 맵핑
  const stockTabMap = useMemo(() => {
    const map: Record<string, TabType[]> = {}
    if (!displayData) return map
    const add = (stocks: Stock[] | undefined, tab: TabType) => {
      for (const s of stocks || []) {
        if (!map[s.code]) map[s.code] = []
        if (!map[s.code].includes(tab)) map[s.code].push(tab)
      }
    }
    // composite
    if (compositeData) {
      add(compositeData.rising.kospi, "composite")
      add(compositeData.rising.kosdaq, "composite")
      add(compositeData.falling.kospi, "composite")
      add(compositeData.falling.kosdaq, "composite")
    } else if (displayData.rising && displayData.falling) {
      add(displayData.rising.kospi, "composite")
      add(displayData.rising.kosdaq, "composite")
      add(displayData.falling.kospi, "composite")
      add(displayData.falling.kosdaq, "composite")
    }
    // trading_value
    add(tradingValueTabData?.kospi?.slice(0, 20), "trading_value")
    add(tradingValueTabData?.kosdaq?.slice(0, 20), "trading_value")
    // volume
    add(volumeTabData?.kospi?.slice(0, 20), "volume")
    add(volumeTabData?.kosdaq?.slice(0, 20), "volume")
    // fluctuation
    add(activeFluctuationData?.kospi_up?.slice(0, 20), "fluctuation")
    add(activeFluctuationData?.kospi_down?.slice(0, 20), "fluctuation")
    add(activeFluctuationData?.kosdaq_up?.slice(0, 20), "fluctuation")
    add(activeFluctuationData?.kosdaq_down?.slice(0, 20), "fluctuation")
    return map
  }, [displayData, compositeData, tradingValueTabData, volumeTabData, activeFluctuationData])

  // 검색용 전체 종목 통합 리스트 (중복 제거, 이름/코드/가격/등락률/탭)
  const allStocksForSearch = useMemo(() => {
    if (!displayData) return []
    const seen = new Set<string>()
    const result: Array<Stock & { tabs: TabType[] }> = []
    const collect = (stocks: Stock[] | undefined) => {
      for (const s of stocks || []) {
        if (seen.has(s.code)) continue
        seen.add(s.code)
        result.push({ ...s, tabs: stockTabMap[s.code] || [] })
      }
    }
    // composite
    if (compositeData) {
      collect(compositeData.rising.kospi)
      collect(compositeData.rising.kosdaq)
      collect(compositeData.falling.kospi)
      collect(compositeData.falling.kosdaq)
    }
    collect(tradingValueTabData?.kospi)
    collect(tradingValueTabData?.kosdaq)
    collect(volumeTabData?.kospi)
    collect(volumeTabData?.kosdaq)
    collect(activeFluctuationData?.kospi_up)
    collect(activeFluctuationData?.kospi_down)
    collect(activeFluctuationData?.kosdaq_up)
    collect(activeFluctuationData?.kosdaq_down)
    if (displayData.rising) {
      collect(displayData.rising.kospi)
      collect(displayData.rising.kosdaq)
    }
    if (displayData.falling) {
      collect(displayData.falling.kospi)
      collect(displayData.falling.kosdaq)
    }
    return result
  }, [displayData, compositeData, tradingValueTabData, volumeTabData, activeFluctuationData, stockTabMap])

  // 탭 전환 후 스크롤 대기 처리 (DOM 렌더링 대기 재시도)
  useEffect(() => {
    if (!pendingScrollTarget) return
    let cancelled = false
    let attempts = 0
    const tryScroll = () => {
      if (cancelled) return
      const el = document.getElementById(`stock-${pendingScrollTarget}`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        setPendingScrollTarget(null)
        return
      }
      attempts++
      if (attempts < 5) {
        setTimeout(tryScroll, 50)
      } else {
        setPendingScrollTarget(null)
      }
    }
    requestAnimationFrame(tryScroll)
    return () => { cancelled = true }
  }, [pendingScrollTarget, activeTab])

  // 대장주 클릭 시 해당 종목으로 이동
  const scrollToStock = useCallback((code: string) => {
    // 1. 현재 탭에서 찾기
    const el = document.getElementById(`stock-${code}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    // 2. 다른 탭에서 찾기
    const tabs = stockTabMap[code]
    if (tabs && tabs.length > 0) {
      const targetTab = tabs.find(t => t !== activeTab) || tabs[0]
      setActiveTab(targetTab)
      setPendingScrollTarget(code)
      return
    }
    // 3. 모든 탭에 없음
    alert("모든 탭에 해당 종목이 없습니다.")
  }, [stockTabMap, activeTab])

  // 탭 전환 핸들러 (활동 로그 포함)
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: "instant" })
    logActivity("tab_switch", { tab })
  }, [logActivity])

  const handleFluctuationModeChange = useCallback((mode: FluctuationMode) => {
    setFluctuationMode(mode)
    logActivity("mode_change", { fluctuation_mode: mode })
  }, [logActivity])

  const handleCompositeModeChange = useCallback((mode: CompositeMode) => {
    setCompositeMode(mode)
    logActivity("mode_change", { composite_mode: mode })
  }, [logActivity])

  // 히스토리 버튼 클릭 핸들러
  const handleHistoryClick = async () => {
    await fetchIndex()
    setShowHistoryModal(true)
  }

  // 히스토리 항목 선택 핸들러
  const handleHistorySelect = async (entry: HistoryEntry) => {
    await fetchHistoryData(entry)
    setShowHistoryModal(false)
    logActivity("history_view", { date: entry.date })
  }

  // 실시간 데이터로 돌아가기
  const handleBackToLive = () => {
    clearSelection()
  }

  // 데이터 수동 새로고침 핸들러
  const handleRefresh = useCallback(() => {
    refreshFromAPI()
    logActivity("data_refresh")
  }, [refreshFromAPI, logActivity])

  // Auth guard
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  if (loading && !currentData) {
    return (
      <div className="min-h-screen bg-background">
        {/* Skeleton header */}
        <div className="h-14 sm:h-16 border-b bg-card shadow-sm" />
        <div className="container px-3 sm:px-4 py-6">
          {/* Skeleton cards */}
          <div className="space-y-4">
            <div className="h-16 rounded-lg bg-muted/50 animate-pulse" />
            <div className="h-12 rounded-lg bg-muted/40 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-32 rounded-lg bg-muted/30 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 mt-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    )
  }

  // 요일 계산
  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      <Header
        timestamp={displayData?.timestamp}
        onRefresh={handleRefresh}
        loading={loading}
        compactMode={compactMode}
        onToggleCompact={toggleCompactMode}
        onHistoryClick={handleHistoryClick}
        isViewingHistory={isViewingHistory}
        refreshElapsed={refreshElapsed}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        isAdmin={isAdmin}
        headerHidden={headerHidden}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onCancelRefresh={cancelRefresh}
        onSearchClick={() => setSearchOpen(prev => !prev)}
        searchOpen={searchOpen}
      />

      {/* 종목 검색 패널 */}
      {searchOpen && currentPage === "home" && (
        <StockSearchPanel
          stocks={allStocksForSearch}
          onSelect={(code) => {
            setSearchOpen(false)
            scrollToStock(code)
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}

      <PullToRefreshIndicator pullDistance={pullDistance} canRelease={canRelease} isRefreshing={isRefreshing} />

      {/* 모의투자 페이지 */}
      {currentPage === "paper-trading" && (
        <main className="container px-3 sm:px-4 py-4 sm:py-6">
          <PaperTradingPage />
        </main>
      )}

      {/* 유망 테마 예측 페이지 */}
      {currentPage === "theme-forecast" && (
        <main className="container px-3 sm:px-4 py-4 sm:py-6">
          <ThemeForecastPage criteriaData={displayData?.criteria_data} isAdmin={isAdmin} />
        </main>
      )}

      {/* 메인 대시보드 */}
      {currentPage === "home" && <>
      {/* 히스토리 배너 + Tab Bar + 퀵네비 (하나의 sticky 컨테이너) */}
      {/* marginTop으로 TabBar를 위로 밀어냄 — 퀵네비만 표시 */}
      <div
        ref={stickyBarRef}
        className={cn("sticky z-40 bg-background", headerHidden ? "top-0" : "top-[5.75rem] sm:top-16")}
      >
        <div style={{ display: headerHidden ? "none" : "block" }}>
        <div
          ref={collapsibleRef}
        >
        {isViewingHistory && selectedEntry && (
          <div className="bg-muted/80 border-b border-border backdrop-blur-sm">
            <div className="container px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-medium">
                    {selectedEntry.date.replace(/-/g, ".")} ({getWeekday(selectedEntry.date)})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-medium">{selectedEntry.time}</span>
                </div>
                <span className="text-xs text-muted-foreground/70 hidden sm:inline">
                  과거 데이터
                </span>
              </div>
              <button
                onClick={handleBackToLive}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md",
                  "text-xs sm:text-sm font-medium",
                  "bg-primary/10 hover:bg-primary/20",
                  "text-primary",
                  "transition-colors duration-150"
                )}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">최신으로 돌아가기</span>
                <span className="sm:hidden">돌아가기</span>
              </button>
            </div>
          </div>
        )}
        <TabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          fluctuationMode={fluctuationMode}
          onFluctuationModeChange={handleFluctuationModeChange}
          compositeMode={compositeMode}
          onCompositeModeChange={handleCompositeModeChange}
        />
        </div>
        </div>
        {/* 섹션 퀵네비 (항상 표시) */}
        <div className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700">
          <div className="container flex items-center gap-1 px-1.5 sm:px-4 py-1.5">
            {[
              ...(isAdmin && macroData ? [{ id: "section-macro", label: "거시지표", type: "neutral" as const }] : []),
              ...(displayData?.theme_analysis ? [{ id: "section-theme", label: "AI테마", type: "neutral" as const }] : []),
              ...(activeTab === "composite" ? [
                { id: "section-rising-kospi", label: "↑KOSPI", type: "rising" as const },
                { id: "section-rising-kosdaq", label: "↑KOSDAQ", type: "rising" as const },
                { id: "section-falling-kospi", label: "↓KOSPI", type: "falling" as const },
                { id: "section-falling-kosdaq", label: "↓KOSDAQ", type: "falling" as const },
              ] : activeTab === "trading_value" ? [
                { id: "section-trading-kospi", label: "KOSPI", type: "neutral" as const },
                { id: "section-trading-kosdaq", label: "KOSDAQ", type: "neutral" as const },
              ] : activeTab === "volume" ? [
                { id: "section-volume-kospi", label: "KOSPI", type: "neutral" as const },
                { id: "section-volume-kosdaq", label: "KOSDAQ", type: "neutral" as const },
              ] : activeTab === "fluctuation" ? [
                { id: "section-fluc-rising-kospi", label: "↑KOSPI", type: "rising" as const },
                { id: "section-fluc-rising-kosdaq", label: "↑KOSDAQ", type: "rising" as const },
                { id: "section-fluc-falling-kospi", label: "↓KOSPI", type: "falling" as const },
                { id: "section-fluc-falling-kosdaq", label: "↓KOSDAQ", type: "falling" as const },
              ] : []),
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  if (s.id === "section-macro") {
                    window.scrollTo({ top: 0, behavior: "smooth" })
                    return
                  }
                  const el = document.getElementById(s.id)
                  if (el) {
                    const headerH = headerHidden ? 0 : (window.innerWidth >= 640 ? 64 : 56)
                    const stickyH = stickyBarRef.current?.offsetHeight || 0
                    const y = el.getBoundingClientRect().top + window.scrollY - headerH - stickyH - 8
                    window.scrollTo({ top: y, behavior: "smooth" })
                  }
                }}
                className={cn(
                  "flex-1 px-0.5 py-1 rounded-full text-[10px] sm:text-xs font-medium text-center whitespace-nowrap",
                  "shadow-sm border transition-all duration-150",
                  "hover:shadow-md hover:scale-105 active:scale-95 active:shadow-none",
                  s.type === "rising"
                    ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    : s.type === "falling"
                    ? "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                    : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="container px-3 sm:px-4 py-4 sm:py-6">
        {apiAlerts.length > 0 && <ApiKeyAlertBanner alerts={apiAlerts} />}

        {error && !isViewingHistory && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-warning/10 border border-warning/20 text-warning">
            <p className="text-xs sm:text-sm">{error} (이전 데이터를 표시합니다)</p>
          </div>
        )}

        {/* Macro Indicators - Admin only */}
        {isAdmin && macroData && <div id="section-macro"><MacroIndicators data={macroData} history={indicatorHistory} historyLoading={indicatorHistoryLoading} onRequestHistory={fetchIndicatorHistory} /></div>}

        {/* Exchange Rate */}
        {displayData?.exchange && <div id="section-exchange"><ExchangeRate exchange={displayData.exchange} history={indicatorHistory} historyLoading={indicatorHistoryLoading} onRequestHistory={fetchIndicatorHistory} /></div>}

        {/* Index MA Alert (KOSPI + KOSDAQ) */}
        <div id="section-index"><IndexAlertSection kospi={displayData?.kospi_index} kosdaq={displayData?.kosdaq_index} /></div>

        {/* AI Theme Analysis */}
        {displayData?.theme_analysis && (
          <div id="section-theme"><AIThemeAnalysis
            themeAnalysis={displayData.theme_analysis}
            criteriaData={displayData?.criteria_data}
            isAdmin={isAdmin}
            onScrollToStock={scrollToStock}
            stockMarketMap={(() => {
              const map: Record<string, string> = {}
              const sections = [displayData.rising, displayData.falling, displayData.volume, displayData.trading_value]
              for (const sec of sections) {
                if (!sec) continue
                for (const s of sec.kospi || []) map[s.code] = 'kospi'
                for (const s of sec.kosdaq || []) map[s.code] = 'kosdaq'
              }
              return map
            })()}
            stockTradingRankMap={(() => {
              const map: Record<string, number> = {}
              const tv = displayData.trading_value
              if (tv) {
                for (const s of tv.kospi || []) map[s.code] = s.rank
                for (const s of tv.kosdaq || []) map[s.code] = s.rank
              }
              return map
            })()}
          /></div>
        )}

        {/* Criteria Legend (admin only) */}
        {isAdmin && displayData?.criteria_data && (
          <div className="mb-4">
            <CriteriaLegend />
          </div>
        )}

        {/* Tab Content */}
        <div id="section-stocks" key={activeTab} className="space-y-4 sm:space-y-6 animate-tab-fade-in">
          {activeTab === "composite" && displayData && (
            <>
              {compositeData ? (
                <>
                  <StockList
                    title={`${compositeTitle} + 상승률 TOP`}
                    kospiStocks={compositeData.rising.kospi}
                    kosdaqStocks={compositeData.rising.kosdaq}
                    history={displayData.history}
                    news={displayData.news}
                    type="rising"
                    compactMode={compactMode}
                    showTradingValue={true}
                    investorData={displayData.investor_data}
                    investorEstimated={displayData?.investor_estimated}
                    investorUpdatedAt={displayData?.investor_updated_at}
                    memberData={displayData?.member_data}
                    criteriaData={displayData?.criteria_data}
                    investorIntraday={investorIntradayData ?? undefined}
                    isAdmin={isAdmin}
                    dataTimestamp={displayData?.timestamp}
                    volumeProfiles={vpData?.profiles}
                    vpUpdatedAt={vpData?.updated_at}
                    intradayHistory={intradayHistoryData?.stocks}
                    initialLimit={20}
                    sectionId="section-rising"
                  />
                  <StockList
                    title={`${compositeTitle} + 하락률 TOP`}
                    kospiStocks={compositeData.falling.kospi}
                    kosdaqStocks={compositeData.falling.kosdaq}
                    history={displayData.history}
                    news={displayData.news}
                    type="falling"
                    compactMode={compactMode}
                    showTradingValue={true}
                    investorData={displayData.investor_data}
                    investorEstimated={displayData?.investor_estimated}
                    investorUpdatedAt={displayData?.investor_updated_at}
                    memberData={displayData?.member_data}
                    criteriaData={displayData?.criteria_data}
                    investorIntraday={investorIntradayData ?? undefined}
                    isAdmin={isAdmin}
                    dataTimestamp={displayData?.timestamp}
                    volumeProfiles={vpData?.profiles}
                    vpUpdatedAt={vpData?.updated_at}
                    intradayHistory={intradayHistoryData?.stocks}
                    initialLimit={20}
                    sectionId="section-falling"
                  />
                </>
              ) : (
                <>
                  {/* 이전 JSON 폴백: 기존 rising/falling 그대로 사용 */}
                  <StockList
                    title={`${compositeTitle} + 상승률 TOP10`}
                    kospiStocks={displayData.rising.kospi}
                    kosdaqStocks={displayData.rising.kosdaq}
                    history={displayData.history}
                    news={displayData.news}
                    type="rising"
                    compactMode={compactMode}
                    showTradingValue={true}
                    investorData={displayData.investor_data}
                    investorEstimated={displayData?.investor_estimated}
                    investorUpdatedAt={displayData?.investor_updated_at}
                    memberData={displayData?.member_data}
                    criteriaData={displayData?.criteria_data}
                    investorIntraday={investorIntradayData ?? undefined}
                    isAdmin={isAdmin}
                    dataTimestamp={displayData?.timestamp}
                    volumeProfiles={vpData?.profiles}
                    vpUpdatedAt={vpData?.updated_at}
                    intradayHistory={intradayHistoryData?.stocks}
                  />
                  <StockList
                    title={`${compositeTitle} + 하락률 TOP10`}
                    kospiStocks={displayData.falling.kospi}
                    kosdaqStocks={displayData.falling.kosdaq}
                    history={displayData.history}
                    news={displayData.news}
                    type="falling"
                    compactMode={compactMode}
                    showTradingValue={true}
                    investorData={displayData.investor_data}
                    investorEstimated={displayData?.investor_estimated}
                    investorUpdatedAt={displayData?.investor_updated_at}
                    memberData={displayData?.member_data}
                    criteriaData={displayData?.criteria_data}
                    investorIntraday={investorIntradayData ?? undefined}
                    isAdmin={isAdmin}
                    dataTimestamp={displayData?.timestamp}
                    volumeProfiles={vpData?.profiles}
                    vpUpdatedAt={vpData?.updated_at}
                    intradayHistory={intradayHistoryData?.stocks}
                  />
                </>
              )}
            </>
          )}

          {activeTab === "trading_value" && displayData && tradingValueTabData && (
            <StockList
              title="거래대금 TOP20"
              kospiStocks={tradingValueTabData.kospi.slice(0, 20)}
              kosdaqStocks={tradingValueTabData.kosdaq.slice(0, 20)}
              history={displayData.history}
              news={displayData.news}
              type="neutral"
              compactMode={compactMode}
              showTradingValue={true}
              investorData={displayData.investor_data}
              investorEstimated={displayData?.investor_estimated}
              investorUpdatedAt={displayData?.investor_updated_at}
              memberData={displayData?.member_data}
              criteriaData={displayData?.criteria_data}
              investorIntraday={investorIntradayData ?? undefined}
              isAdmin={isAdmin}
              dataTimestamp={displayData?.timestamp}
              volumeProfiles={vpData?.profiles}
              vpUpdatedAt={vpData?.updated_at}
              intradayHistory={intradayHistoryData?.stocks}
              sectionId="section-trading"
            />
          )}

          {activeTab === "volume" && displayData && volumeTabData && (
            <StockList
              title="거래량 TOP20"
              kospiStocks={volumeTabData.kospi.slice(0, 20)}
              kosdaqStocks={volumeTabData.kosdaq.slice(0, 20)}
              history={displayData.history}
              news={displayData.news}
              type="neutral"
              compactMode={compactMode}
              showTradingValue={true}
              investorData={displayData.investor_data}
              investorEstimated={displayData?.investor_estimated}
              investorUpdatedAt={displayData?.investor_updated_at}
              memberData={displayData?.member_data}
              criteriaData={displayData?.criteria_data}
              investorIntraday={investorIntradayData ?? undefined}
              isAdmin={isAdmin}
              dataTimestamp={displayData?.timestamp}
              volumeProfiles={vpData?.profiles}
              vpUpdatedAt={vpData?.updated_at}
              intradayHistory={intradayHistoryData?.stocks}
              sectionId="section-volume"
            />
          )}

          {activeTab === "fluctuation" && displayData && activeFluctuationData && (
            <>
              <StockList
                title="등락률 상승 TOP20"
                kospiStocks={(activeFluctuationData.kospi_up || []).slice(0, 20)}
                kosdaqStocks={(activeFluctuationData.kosdaq_up || []).slice(0, 20)}
                history={displayData.history}
                news={displayData.news}
                type="rising"
                compactMode={compactMode}
                showTradingValue={true}
                investorData={displayData.investor_data}
                investorEstimated={displayData?.investor_estimated}
                investorUpdatedAt={displayData?.investor_updated_at}
                memberData={displayData?.member_data}
                criteriaData={displayData?.criteria_data}
                investorIntraday={investorIntradayData ?? undefined}
                isAdmin={isAdmin}
                dataTimestamp={displayData?.timestamp}
                volumeProfiles={vpData?.profiles}
                vpUpdatedAt={vpData?.updated_at}
                intradayHistory={intradayHistoryData?.stocks}
                sectionId="section-fluc-rising"
              />
              <StockList
                title="등락률 하락 TOP20"
                kospiStocks={(activeFluctuationData.kospi_down || []).slice(0, 20)}
                kosdaqStocks={(activeFluctuationData.kosdaq_down || []).slice(0, 20)}
                history={displayData.history}
                news={displayData.news}
                type="falling"
                compactMode={compactMode}
                showTradingValue={true}
                investorData={displayData.investor_data}
                investorEstimated={displayData?.investor_estimated}
                investorUpdatedAt={displayData?.investor_updated_at}
                memberData={displayData?.member_data}
                criteriaData={displayData?.criteria_data}
                investorIntraday={investorIntradayData ?? undefined}
                isAdmin={isAdmin}
                dataTimestamp={displayData?.timestamp}
                volumeProfiles={vpData?.profiles}
                vpUpdatedAt={vpData?.updated_at}
                intradayHistory={intradayHistoryData?.stocks}
                sectionId="section-fluc-falling"
              />
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-border/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[10px] sm:text-xs text-muted-foreground/60">
            <div className="flex items-center gap-3">
              <span>KIS API · Naver News API</span>
              <span className="hidden sm:inline">·</span>
              <span>매일 09:30, 21:00 KST 자동 업데이트</span>
            </div>
            <span>투자 판단의 책임은 본인에게 있습니다</span>
          </div>
        </footer>
      </main>

      </>}

      {/* History Modal */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        groupedHistory={groupedHistory}
        onSelect={handleHistorySelect}
        loading={historyLoading}
        error={historyError}
      />

      {/* Scroll to Top */}
      <button
        onClick={scrollToTop}
        aria-label="맨 위로 이동"
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "w-10 h-10 rounded-full",
          "shadow-lg",
          "flex items-center justify-center",
          "hover:scale-110 active:scale-95",
          "transition-all duration-200",
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none",
        )}
        style={{
          backgroundColor: "rgba(120, 120, 140, 0.15)",
          color: "rgba(50, 50, 60, 0.6)",
          border: "1px solid rgba(120, 120, 140, 0.1)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  )
}

export default App
