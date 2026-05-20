import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react"
import { createPortal } from "react-dom"
import { Header } from "@/components/Header"
import { ExchangeRate } from "@/components/ExchangeRate"
import { AIThemeAnalysis } from "@/components/AIThemeAnalysis"
import { IntradayInsights } from "@/components/IntradayInsights"
import { DataFreshness } from "@/components/DataFreshness"
import { StockList } from "@/components/StockList"
import { TabBar, TabControls } from "@/components/TabBar"
import { HistoryModal } from "@/components/HistoryModal"
const PaperTradingPage = lazy(() => import("@/components/PaperTradingPage").then(m => ({ default: m.PaperTradingPage })))
const ThemeForecastPage = lazy(() => import("@/components/ThemeForecastPage").then(m => ({ default: m.ThemeForecastPage })))
const PortfolioPage = lazy(() => import("@/components/PortfolioPage").then(m => ({ default: m.PortfolioPage })))
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
import { useThemeForecast } from "@/hooks/useThemeForecast"
import { useStockHistory } from "@/hooks/useStockHistory"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { useScrollLock } from "@/hooks/useScrollLock"
import { MacroIndicators } from "@/components/MacroIndicators"
import { Loader2, ArrowLeft, Calendar, Clock, ChevronUp, Search, X, History as HistoryIcon } from "lucide-react"
import { getRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } from "@/lib/recent-search"
import { cn, getWeekday } from "@/lib/utils"
import type { HistoryEntry } from "@/types/history"
import type { TabType, FluctuationMode, CompositeMode, Stock } from "@/types/stock"

type PageType = "home" | "ai-analysis" | "paper-trading" | "theme-forecast" | "portfolio"

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
  const [recent, setRecent] = useState<string[]>(() => getRecentSearches())
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

  const handleSelect = useCallback((code: string) => {
    setRecent(addRecentSearch(code))
    onSelect(code)
  }, [onSelect])

  const handleRemoveRecent = useCallback((code: string) => {
    setRecent(removeRecentSearch(code))
  }, [])

  const handleClearRecent = useCallback(() => {
    clearRecentSearches()
    setRecent([])
  }, [])

  // 최근검색 → 종목 매칭 (마스터에 없는 종목은 코드만 표시)
  const recentStocks = useMemo(() => {
    return recent.map(code => {
      const stock = stocks.find(s => s.code === code)
      return stock ? { ...stock, _matched: true as const } : { code, name: code, change_rate: 0, tabs: [], _matched: false as const }
    })
  }, [recent, stocks])

  const filtered = useMemo(() => {
    if (!query.trim()) return []
    const q = query.trim().toLowerCase()
    return stocks.filter(s =>
      s.name.toLowerCase().includes(q) || s.code.includes(q)
    ).slice(0, 20)
  }, [query, stocks])

  return (
    <div className="sticky top-[5.75rem] sm:top-16 z-[45] bg-card border-b border-border shadow-md animate-tab-fade-in">
      <div className="container px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2 rounded-lg border border-transparent focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/20 transition-all px-1">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="종목명 또는 코드 검색..."
            className="flex-1 bg-transparent text-base sm:text-sm outline-none placeholder:text-muted-foreground/50"
            autoComplete="off"
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
        {/* 최근검색 (query 비어있을 때만) */}
        {!query.trim() && recent.length > 0 && (
          <div className="mt-2 border-t border-border/30 pt-1.5">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <HistoryIcon className="w-3 h-3" />
                최근검색
              </span>
              <button
                onClick={handleClearRecent}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
              >
                전체 지우기
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {recentStocks.map(s => {
                const isUp = s.change_rate > 0
                const isDown = s.change_rate < 0
                return (
                  <div key={s.code} className="group flex items-center w-full hover:bg-muted/60 rounded-md transition-colors">
                    <button
                      onClick={() => handleSelect(s.code)}
                      className="flex-1 flex items-center justify-between px-2 py-2 text-left min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("text-sm font-medium truncate", !s._matched && "text-muted-foreground")}>{s.name}</span>
                        <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">{s.code}</span>
                      </div>
                      {s._matched && (
                        <span className={cn(
                          "text-xs font-semibold tabular-nums shrink-0",
                          isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-foreground/70"
                        )}>
                          {isUp ? "+" : ""}{s.change_rate.toFixed(2)}%
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => handleRemoveRecent(s.code)}
                      className="px-2 py-2 text-muted-foreground/40 hover:text-destructive transition-colors"
                      aria-label="최근검색에서 제거"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="mt-2 max-h-64 overflow-y-auto border-t border-border/30 pt-1">
            {filtered.map(s => {
              const isUp = s.change_rate > 0
              const isDown = s.change_rate < 0
              return (
                <button
                  key={s.code}
                  onClick={() => handleSelect(s.code)}
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
                        <span key={t} className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground/70">{TAB_LABELS[t]}</span>
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

const SCHEDULE_DATA = [
  { category: "장전", items: [
    { time: "07:00", label: "해외 시장/환율", desc: "나스닥100 선물, 해외 ETF(MU/SOXX/EWY/KORU), KOSPI200, 환율(USD/JPY/EUR/CNY)" },
    { time: "07:30", label: "AI 유망 테마 예측", desc: "Gemini AI 장전 테마/섹터 예측 → 'AI 유망 테마 예측' 화면" },
    { time: "09:10", label: "선물/거시지표", desc: "KOSPI200 선물 + 전체 거시지표 갱신" },
  ]},
  { category: "장중 데이터 수집 + 당일 테마 및 대장주 AI분석", items: [
    { time: "09:05", label: "1차 전체 수집", desc: "KIS 등락률/거래량/거래대금 + 뉴스 + AI 테마 분석 + 환율" },
    { time: "09:28", label: "2차 전체 수집", desc: "KIS 등락률/거래량/거래대금 + 뉴스 + AI 테마 분석 + 환율" },
  ]},
  { category: "장중 수급(외국인/기관)", items: [
    { time: "09:31", label: "1차 가집계", desc: "외국인 09:30 반영" },
    { time: "10:01", label: "2차 가집계", desc: "기관 10:00 반영" },
    { time: "12:00", label: "3차 가집계", desc: "외국인+기관 반영" },
    { time: "13:25", label: "4차 가집계", desc: "외국인+기관 반영" },
    { time: "14:35", label: "5차 가집계", desc: "외국인+기관 반영 (장중 최종)" },
    { time: "15:50", label: "장후 수집", desc: "장 마감 후 수급 데이터 수집" },
    { time: "18:05", label: "확정 + 검증", desc: "확정치 수집 + pykrx 교차검증" },
  ]},
  { category: "장중 등락 히스토리", items: [
    { time: "09:15~15:15", label: "매30분 수집", desc: "1분봉 → 30분/1시간 집계 (09:15부터 15:15까지 30분 간격, 13회)" },
    { time: "12:30, 15:40", label: "추가 수집", desc: "보충 수집 (장중 + 장 마감 직후)" },
  ]},
  { category: "장중 유망 테마 재예측 → 'AI 유망 테마 예측' 화면", items: [
    { time: "09:30", label: "장 초반 예측", desc: "장 개시 직후 실시간 데이터 기반 테마 예측" },
    { time: "10:00", label: "조기 재예측", desc: "장중 실시간 데이터 기반 유망 테마 보정" },
    { time: "10:30", label: "오전 중반", desc: "오전 흐름 반영 유망 테마 보정" },
    { time: "11:30", label: "오전 마감", desc: "오전장 마감 전후 테마 보정" },
    { time: "13:00", label: "오후 재예측", desc: "오후 흐름 반영 유망 테마 보정" },
    { time: "13:30", label: "오후 중반", desc: "오후 중반 흐름 반영 테마 보정" },
    { time: "14:30", label: "장 마감 전", desc: "장 마감 직전 최종 테마 보정" },
  ]},
  { category: "매물대(Volume Profile) 분석", items: [
    { time: "09:30~14:30", label: "장중 매물대", desc: "테마 재예측 시 함께 수집 (상위 80종목, 7회)" },
    { time: "15:40", label: "장후 매물대 (전체)", desc: "모의투자 수집 시 전체 종목 매물대 분석" },
  ]},
  { category: "장후", items: [
    { time: "15:40", label: "모의투자", desc: "AI 선정 대장주 매수 시뮬레이션 → 종가 매도 수익률 산출 + 장중 히스토리" },
    { time: "18:00", label: "백테스트", desc: "예측 모델 적중률 평가 (예측 vs 실제 가격)" },
  ]},
]

function SchedulePanel({ onClose }: { onClose: () => void }) {
  const { handleRef, sheetRef } = useSwipeToDismiss(onClose)

  // 스크롤 잠금
  useScrollLock(true)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  // 현재 KST 시각
  const nowKST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
  const nowHHMM = `${String(nowKST.getHours()).padStart(2, "0")}:${String(nowKST.getMinutes()).padStart(2, "0")}`
  const isWeekday = nowKST.getDay() >= 1 && nowKST.getDay() <= 5

  return createPortal(
    <div className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div
        ref={sheetRef}
        className="relative w-full sm:w-96 sm:max-w-[90vw] max-h-[80vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4"
      >
        <div ref={handleRef} className="sm:hidden flex justify-center mb-2 py-3 cursor-grab">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
        </div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-semibold">데이터 수집 스케줄</span>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">월~금 · cron-job.org → GitHub Actions</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          {SCHEDULE_DATA.map((group) => (
            <div key={group.category}>
              <div className="text-[11px] font-semibold text-muted-foreground/70 mb-1 px-1">{group.category}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const firstTime = item.time.split("~")[0].split(",")[0].trim()
                  const isDone = isWeekday && nowHHMM > firstTime
                  const isNext = isWeekday && !isDone && nowHHMM <= firstTime
                  return (
                    <div
                      key={item.time + item.label}
                      className={cn(
                        "flex items-start gap-2 px-2 py-1.5 rounded-md text-left",
                        isNext && "bg-primary/5 border border-primary/20",
                        isDone && "opacity-50"
                      )}
                    >
                      <div className="flex flex-col items-center shrink-0 pt-1">
                        <span className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          isDone ? "bg-green-500/50" : isNext ? "bg-primary ring-2 ring-primary/30" : "bg-border"
                        )} />
                        <div className="w-px flex-1 bg-border/40 mt-0.5" />
                      </div>
                      <span className={cn(
                        "text-[11px] font-mono font-semibold tabular-nums shrink-0 w-[72px]",
                        isNext ? "text-primary" : "text-foreground/70"
                      )}>
                        {item.time}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className={cn("text-xs font-medium", isNext && "text-primary")}>{item.label}</span>
                        <p className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/40 text-center mt-3">주말·공휴일은 수집하지 않습니다</p>
      </div>
    </div>,
    document.body
  )
}

// 로컬 스토리지 키
const COMPACT_MODE_KEY = "stock-dashboard-compact-mode"
const ACTIVE_TAB_KEY = "stock-dashboard-active-tab"
const FLUCTUATION_MODE_KEY = "stock-dashboard-fluctuation-mode"
const COMPOSITE_MODE_KEY = "stock-dashboard-composite-mode"

function App() {
  const { user, loading: authLoading, isAdmin } = useAuth()
  const { toggle: toggleTheme, isDark } = useThemeMode()
  const { data: vpData, refetch: refetchVP } = useVolumeProfile()
  const { data: intradayHistoryData } = useIntradayHistory()
  const { data: macroData } = useMacroIndicators()
  const { data: indicatorHistory, loading: indicatorHistoryLoading, fetchHistory: fetchIndicatorHistory } = useIndicatorHistory()
  const { data: investorIntradayData } = useInvestorIntraday()
  const { data: themeForecastData, refetch: refetchForecast } = useThemeForecast()
  const [currentPage, setCurrentPage] = useState<PageType>("home")

  const apiAlerts = useApiAlerts(isAdmin)
  const { data: currentData, loading, error, refetch, refreshFromAPI, cancelRefresh, refreshElapsed } = useStockData()
  const { history: stockHistoryData, refetchHistory } = useStockHistory()
  // PTR refresh: 4개 데이터 소스 모두 동시 갱신 (사용자 의도적 새로고침)
  const handlePtrRefresh = useCallback(async () => {
    await Promise.all([refetch(), refetchVP(), refetchForecast(), refetchHistory()])
  }, [refetch, refetchVP, refetchForecast, refetchHistory])
  const { containerRef, pullDistance, isRefreshing, canRelease, justCompleted } = usePullToRefresh({
    onRefresh: handlePtrRefresh,
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
  const [scheduleOpen, setScheduleOpen] = useState(false)

  // 컴팩트 모드 상태 (로컬 스토리지에서 복원)
  const [compactMode, setCompactMode] = useState(() => {
    const saved = localStorage.getItem(COMPACT_MODE_KEY)
    return saved === "true"
  })

  // 탭 상태 (로컬 스토리지에서 복원)
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY)
    return (saved as TabType) || "home"
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
  const headerHiddenRef = useRef(false)
  const stickyBarRef = useRef<HTMLDivElement>(null)
  const collapsibleRef = useRef<HTMLDivElement>(null)
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null)
  const triedTabsRef = useRef<Set<TabType>>(new Set())

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
      // 스크롤이 헤더 영역 높이 이하이면 무조건 헤더 표시
      if (currentY <= 100) {
        if (headerHiddenRef.current) {
          setHeaderHidden(false)
          headerHiddenRef.current = false
          scrollCooldown.current = Date.now() + COOLDOWN_MS
        }
        lastScrollY.current = currentY
        return
      }
      const delta = currentY - lastScrollY.current
      if (delta > SCROLL_DEADZONE && currentY > 200) {
        setHeaderHidden(true)
        headerHiddenRef.current = true
        scrollCooldown.current = Date.now() + COOLDOWN_MS
        lastScrollY.current = currentY
      } else if (delta < -SCROLL_DEADZONE) {
        setHeaderHidden(false)
        headerHiddenRef.current = false
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

  // 전체 데이터 소스 중 가장 최근 타임스탬프
  const latestTimestamp = useMemo(() => {
    const candidates = [
      displayData?.timestamp,
      macroData?.updated_at,
      vpData?.updated_at,
    ].filter(Boolean) as string[]
    if (candidates.length === 0) return undefined
    return candidates.sort().pop()
  }, [displayData?.timestamp, macroData?.updated_at, vpData?.updated_at])

  // 종목별 등락률 이력: 별도 파일 우선, fallback은 latest.json 내장 history
  const mergedHistory = stockHistoryData || displayData?.history || {}

  // 장중 동향용 종목코드→이름 맵
  const stockNameMap = useMemo(() => {
    if (!displayData) return {}
    const map: Record<string, string> = {}
    const sections = [displayData.rising, displayData.falling, displayData.volume, displayData.trading_value]
    for (const sec of sections) {
      if (!sec) continue
      for (const s of [...(sec.kospi || []), ...(sec.kosdaq || [])]) {
        if (s.code && s.name) map[s.code] = s.name
      }
    }
    if (displayData.theme_analysis?.themes) {
      for (const theme of displayData.theme_analysis.themes) {
        for (const stock of theme.leader_stocks) {
          if (stock.code && stock.name) map[stock.code] = stock.name
        }
      }
    }
    return map
  }, [displayData])

  // 종목코드→시장(kospi/kosdaq) 매핑
  const stockMarketMap = useMemo(() => {
    if (!displayData) return {}
    const map: Record<string, string> = {}
    const sections = [displayData.rising, displayData.falling, displayData.volume, displayData.trading_value]
    for (const sec of sections) {
      if (!sec) continue
      for (const s of sec.kospi || []) map[s.code] = 'kospi'
      for (const s of sec.kosdaq || []) map[s.code] = 'kosdaq'
    }
    return map
  }, [displayData])

  // 종목코드→거래대금 순위 매핑
  const stockTradingRankMap = useMemo(() => {
    if (!displayData) return {}
    const map: Record<string, number> = {}
    const tv = displayData.trading_value
    if (tv) {
      for (const s of tv.kospi || []) map[s.code] = s.rank
      for (const s of tv.kosdaq || []) map[s.code] = s.rank
    }
    return map
  }, [displayData])

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
        triedTabsRef.current.clear()
        setPendingScrollTarget(null)
        return
      }
      attempts++
      if (attempts < 10) {
        setTimeout(tryScroll, 50)
      } else {
        // 현재 탭에 없으면 stockTabMap에서 해당 종목이 있는 탭으로 전환
        triedTabsRef.current.add(activeTab)
        const tabs = stockTabMap[pendingScrollTarget]
        const untried = tabs?.filter(t => !triedTabsRef.current.has(t))
        if (untried && untried.length > 0) {
          setActiveTab(untried[0])
          // pendingScrollTarget 유지 → 탭 전환 후 useEffect 재실행
        } else {
          triedTabsRef.current.clear()
          setPendingScrollTarget(null)
        }
      }
    }
    requestAnimationFrame(tryScroll)
    return () => { cancelled = true }
  }, [pendingScrollTarget, activeTab, currentPage, stockTabMap])

  // 대장주 클릭 시 해당 종목으로 이동
  const scrollToStock = useCallback((code: string) => {
    triedTabsRef.current.clear()
    // 0. 홈이 아닌 페이지에 있으면 먼저 홈으로 이동
    if (currentPage !== "home") {
      setCurrentPage("home")
      setPendingScrollTarget(code)
      return
    }
    // 1. 현재 탭(환경분석이 아닌 경우)에서 찾기
    if (activeTab !== "home") {
      const el = document.getElementById(`stock-${code}`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        return
      }
    }
    // 2. stockTabMap에서 해당 종목이 있는 탭으로 전환
    const tabs = stockTabMap[code]
    if (tabs && tabs.length > 0) {
      const targetTab = tabs.find(t => t !== activeTab) || tabs[0]
      setActiveTab(targetTab)
      setPendingScrollTarget(code)
      return
    }
    // 3. 모든 탭에 없음
    alert("모든 탭에 해당 종목이 없습니다.")
  }, [stockTabMap, activeTab, currentPage])

  // 탭 전환 핸들러 (활동 로그 포함)
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [])

  const handleFluctuationModeChange = useCallback((mode: FluctuationMode) => {
    setFluctuationMode(mode)
  }, [])

  const handleCompositeModeChange = useCallback((mode: CompositeMode) => {
    setCompositeMode(mode)
  }, [])

  // 히스토리 버튼 클릭 핸들러
  const handleHistoryClick = async () => {
    await fetchIndex()
    setShowHistoryModal(true)
  }

  // 히스토리 항목 선택 핸들러
  const handleHistorySelect = async (entry: HistoryEntry) => {
    await fetchHistoryData(entry)
    setShowHistoryModal(false)
  }

  // 실시간 데이터로 돌아가기
  const handleBackToLive = () => {
    clearSelection()
  }

  // 새로고침 토스트
  const [refreshToast, setRefreshToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  useEffect(() => {
    if (!refreshToast) return
    const timer = setTimeout(() => setRefreshToast(null), 2500)
    return () => clearTimeout(timer)
  }, [refreshToast])

  // 데이터 수동 새로고침 핸들러
  const handleRefresh = useCallback(async () => {
    const ok = await refreshFromAPI()
    setRefreshToast(ok
      ? { message: "데이터를 새로고침했습니다", type: "success" }
      : { message: "새로고침에 실패했습니다. 잠시 후 다시 시도해주세요.", type: "error" }
    )
  }, [refreshFromAPI])

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
        timestamp={latestTimestamp}
        onRefresh={handleRefresh}
        loading={loading}
        compactMode={compactMode}
        onToggleCompact={toggleCompactMode}
        onHistoryClick={handleHistoryClick}
        isViewingHistory={isViewingHistory}
        refreshElapsed={refreshElapsed}
        currentPage={currentPage}
        onPageChange={(page) => {
          setCurrentPage(page)
          if (page === "home") setActiveTab("home")
          if (page === "portfolio") { refetch(); refetchVP(); refetchForecast() }
        }}
        isAdmin={isAdmin}
        headerHidden={headerHidden}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onCancelRefresh={cancelRefresh}
        onSearchClick={() => { setSearchOpen(prev => !prev); setScheduleOpen(false) }}
        searchOpen={searchOpen}
        onScheduleClick={() => { setScheduleOpen(prev => !prev); setSearchOpen(false) }}
        scheduleOpen={scheduleOpen}
      />

      {/* 종목 검색 패널 */}
      {searchOpen && (
        <StockSearchPanel
          stocks={allStocksForSearch}
          onSelect={(code) => {
            setSearchOpen(false)
            scrollToStock(code)
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* 수집 스케줄 패널 */}
      {scheduleOpen && (
        <SchedulePanel onClose={() => setScheduleOpen(false)} />
      )}

      <PullToRefreshIndicator pullDistance={pullDistance} canRelease={canRelease} isRefreshing={isRefreshing} justCompleted={justCompleted} />

      {/* 모의투자 페이지 */}
      {currentPage === "paper-trading" && (
        <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
          <main className="container px-3 sm:px-4 py-4 sm:py-6">
            <PaperTradingPage />
          </main>
        </Suspense>
      )}

      {/* AI 테마 분석 페이지 */}
      {currentPage === "ai-analysis" && displayData?.theme_analysis && (
        <main className="container px-3 sm:px-4 py-4 sm:py-6">
          <AIThemeAnalysis
            themeAnalysis={displayData.theme_analysis}
            criteriaData={displayData?.criteria_data}
            isAdmin={isAdmin}
            onScrollToStock={scrollToStock}
            stockMarketMap={stockMarketMap}
            stockTradingRankMap={stockTradingRankMap}
          />
        </main>
      )}

      {/* 유망 테마 예측 페이지 */}
      {currentPage === "theme-forecast" && (
        <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
          <main className="container px-3 sm:px-4 py-4 sm:py-6">
            <ThemeForecastPage criteriaData={displayData?.criteria_data} isAdmin={isAdmin} />
          </main>
        </Suspense>
      )}

      {/* 포트폴리오 페이지 */}
      {currentPage === "portfolio" && (
        <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
          <main className="container px-3 sm:px-4 py-4 sm:py-6">
            <PortfolioPage
              stockData={currentData ?? null}
              volumeProfileData={vpData ?? null}
              themeForecast={themeForecastData ?? null}
              history={mergedHistory}
            />
          </main>
        </Suspense>
      )}

      {/* 메인 대시보드 */}
      {currentPage === "home" && <>
      {/* 히스토리 배너 + TabControls + 퀵네비 (하나의 sticky 컨테이너, 홈 탭 제외) */}
      {activeTab !== "home" && (
      <div
        ref={stickyBarRef}
        className={cn("sticky z-40 bg-background border-b border-border/30 shadow-sm", headerHidden ? "top-0" : "top-[5.75rem] sm:top-16")}
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
        <TabControls
          activeTab={activeTab}
          onTabChange={handleTabChange}
          fluctuationMode={fluctuationMode}
          onFluctuationModeChange={handleFluctuationModeChange}
          compositeMode={compositeMode}
          onCompositeModeChange={handleCompositeModeChange}
        />
        </div>
        </div>
        {/* 섹션 퀵네비 */}
        <div className="bg-slate-100 dark:bg-[oklch(20%_0.015_250)] border-b border-slate-200 dark:border-[oklch(32%_0.02_250)]">
          <div className="container flex items-center gap-1 px-1.5 sm:px-4 py-1.5">
            {[
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
                    const headerH = headerHidden ? 0 : (window.innerWidth >= 640 ? 64 : 92)
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
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25"
                    : s.type === "falling"
                    ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/25"
                    : "bg-white dark:bg-secondary text-slate-700 dark:text-slate-200 border-slate-200 dark:border-border"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      )}

      <main className="container px-3 sm:px-4 py-4 sm:py-6">
        {apiAlerts.length > 0 && <ApiKeyAlertBanner alerts={apiAlerts} />}

        {error && !isViewingHistory && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-warning/10 border border-warning/20 text-warning">
            <p className="text-xs sm:text-sm">{error} (이전 데이터를 표시합니다)</p>
          </div>
        )}

        {/* 홈 탭 전용 콘텐츠 */}
        {activeTab === "home" && <>
          {/* Macro Indicators - Admin only */}
          {isAdmin && macroData && <div id="section-macro"><MacroIndicators data={macroData} history={indicatorHistory} historyLoading={indicatorHistoryLoading} onRequestHistory={fetchIndicatorHistory} kospiIndex={displayData?.kospi_index} kosdaqIndex={displayData?.kosdaq_index} /></div>}

          {/* Exchange Rate */}
          {displayData?.exchange && <div id="section-exchange"><ExchangeRate exchange={displayData.exchange} history={indicatorHistory} historyLoading={indicatorHistoryLoading} onRequestHistory={fetchIndicatorHistory} /></div>}

          {/* Index MA Alert (KOSPI + KOSDAQ) */}
          <div id="section-index"><IndexAlertSection kospi={displayData?.kospi_index} kosdaq={displayData?.kosdaq_index} investorTrend={macroData?.investor_trend} /></div>

          {/* Data Freshness */}
          <div className="mb-3 sm:mb-4">
          <DataFreshness
            stockData={currentData ?? null}
            investorIntraday={investorIntradayData ?? null}
            intradayHistory={intradayHistoryData ?? null}
            themeForecast={themeForecastData ?? null}
          />
          </div>

          {/* Intraday Insights */}
          <div id="section-intraday-insights">
            <IntradayInsights
              themeAnalysis={displayData?.theme_analysis}
              themeForecast={themeForecastData}
              intradayHistory={intradayHistoryData}
              investorIntraday={investorIntradayData}
              stockNameMap={stockNameMap}
              onNavigateToForecast={() => setCurrentPage("theme-forecast")}
              onScrollToStock={scrollToStock}
            />
          </div>

          {/* AI Theme Analysis → ai-analysis 페이지로 이동됨 */}
        </>}

        {/* 홈 탭이 아닐 때만 종목 리스트 표시 */}
        {activeTab !== "home" && <>
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
                    history={mergedHistory}
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
                    fundamentalData={displayData?.fundamental_data}
                    initialLimit={20}
                    sectionId="section-rising"
                    expandForCode={pendingScrollTarget}
                  />
                  <StockList
                    title={`${compositeTitle} + 하락률 TOP`}
                    kospiStocks={compositeData.falling.kospi}
                    kosdaqStocks={compositeData.falling.kosdaq}
                    history={mergedHistory}
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
                    fundamentalData={displayData?.fundamental_data}
                    initialLimit={20}
                    sectionId="section-falling"
                    expandForCode={pendingScrollTarget}
                  />
                </>
              ) : (
                <>
                  {/* 이전 JSON 폴백: 기존 rising/falling 그대로 사용 */}
                  <StockList
                    title={`${compositeTitle} + 상승률 TOP10`}
                    kospiStocks={displayData.rising.kospi}
                    kosdaqStocks={displayData.rising.kosdaq}
                    history={mergedHistory}
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
                    fundamentalData={displayData?.fundamental_data}
                  />
                  <StockList
                    title={`${compositeTitle} + 하락률 TOP10`}
                    kospiStocks={displayData.falling.kospi}
                    kosdaqStocks={displayData.falling.kosdaq}
                    history={mergedHistory}
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
                    fundamentalData={displayData?.fundamental_data}
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
              history={mergedHistory}
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
              fundamentalData={displayData?.fundamental_data}
              sectionId="section-trading"
              expandForCode={pendingScrollTarget}
            />
          )}

          {activeTab === "volume" && displayData && volumeTabData && (
            <StockList
              title="거래량 TOP20"
              kospiStocks={volumeTabData.kospi.slice(0, 20)}
              kosdaqStocks={volumeTabData.kosdaq.slice(0, 20)}
              history={mergedHistory}
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
              fundamentalData={displayData?.fundamental_data}
              sectionId="section-volume"
              expandForCode={pendingScrollTarget}
            />
          )}

          {activeTab === "fluctuation" && displayData && activeFluctuationData && (
            <>
              <StockList
                title="등락률 상승 TOP20"
                kospiStocks={(activeFluctuationData.kospi_up || []).slice(0, 20)}
                kosdaqStocks={(activeFluctuationData.kosdaq_up || []).slice(0, 20)}
                history={mergedHistory}
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
                expandForCode={pendingScrollTarget}
              />
              <StockList
                title="등락률 하락 TOP20"
                kospiStocks={(activeFluctuationData.kospi_down || []).slice(0, 20)}
                kosdaqStocks={(activeFluctuationData.kosdaq_down || []).slice(0, 20)}
                history={mergedHistory}
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
                expandForCode={pendingScrollTarget}
              />
            </>
          )}
        </div>
        </>}

        {/* 하단 탭바 높이만큼 여백 */}
        <div className="h-16" />
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

      {/* 하단 고정 탭 바 (메인 대시보드에서만) */}
      {currentPage === "home" && (
        <TabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}

      {/* Scroll to Top */}
      <button
        onClick={scrollToTop}
        aria-label="맨 위로 이동"
        className={cn(
          "fixed bottom-20 right-6 z-50",
          "w-10 h-10 rounded-full",
          "shadow-lg",
          "flex items-center justify-center",
          "hover:scale-110 active:scale-95",
          "transition-all duration-200",
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none",
        )}
        style={{
          backgroundColor: isDark ? "rgba(180, 180, 200, 0.2)" : "rgba(120, 120, 140, 0.15)",
          color: isDark ? "rgba(220, 220, 230, 0.8)" : "rgba(50, 50, 60, 0.6)",
          border: isDark ? "1px solid rgba(180, 180, 200, 0.2)" : "1px solid rgba(120, 120, 140, 0.1)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <ChevronUp className="w-5 h-5" />
      </button>

      {/* 새로고침 토스트 */}
      {refreshToast && createPortal(
        <div className={cn(
          "fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all animate-in fade-in slide-in-from-top-2 duration-200",
          refreshToast.type === "success"
            ? "bg-emerald-600 text-white"
            : "bg-destructive text-destructive-foreground"
        )}>
          {refreshToast.message}
        </div>,
        document.body
      )}
    </div>
  )
}

export default App
