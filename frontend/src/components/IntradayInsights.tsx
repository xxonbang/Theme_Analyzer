import { useMemo, useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Activity, Sparkles, TrendingUp, TrendingDown, ChevronDown, ChevronUp, ShieldAlert, ExternalLink, Send, History, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ThemeAnalysis, IntradayHistoryData, InvestorIntraday, ThemeForecast } from "@/types/stock"

interface InsightsSnapshot {
  date: string
  updated_at: string
  theme_momentum: { name: string; avg_rate: number; stocks: { code: string; name: string; rate: number }[] }[]
  movers: { gainers: { code: string; name: string; rate: number; delta: number }[]; losers: { code: string; name: string; rate: number; delta: number }[] }
  signals: { code: string; name: string; label: string; rate: number; f: number; i: number; pg: number }[]
}

interface InsightsHistory {
  updated_at: string
  snapshots: InsightsSnapshot[]
}

interface IntradayInsightsProps {
  themeAnalysis?: ThemeAnalysis
  themeForecast?: ThemeForecast | null
  intradayHistory?: IntradayHistoryData | null
  investorIntraday?: InvestorIntraday | null
  stockNameMap: Record<string, string>
  onNavigateToForecast?: () => void
  onScrollToStock?: (code: string) => void
}

function getTodayKST(): string {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  return new Date(utc + 9 * 3600000).toISOString().slice(0, 10)
}

export function IntradayInsights({
  themeAnalysis,
  themeForecast,
  intradayHistory,
  investorIntraday,
  stockNameMap,
  onNavigateToForecast,
  onScrollToStock,
}: IntradayInsightsProps) {
  const [showMovers, setShowMovers] = useState(true)
  const [actionPopup, setActionPopup] = useState<{ code: string; name: string; x: number; y: number } | null>(null)
  const [themePopup, setThemePopup] = useState<{ name: string; stocks: { code: string; name: string; rate: number }[]; x: number; y: number } | null>(null)
  const [signalHelpPopup, setSignalHelpPopup] = useState<{ x: number; y: number } | null>(null)
  // todayKST를 매 분 갱신 (자정 전후 페이지 유지 시에도 정확한 날짜 사용)
  const [todayKST, setTodayKST] = useState(getTodayKST)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = getTodayKST()
      setTodayKST(prev => prev !== now ? now : prev)
    }, 60_000) // 1분마다 체크
    return () => clearInterval(timer)
  }, [])

  // 자정 초기화: 데이터가 오늘 날짜가 아니면 라이브 데이터 숨김
  const isDataFresh = useMemo(() => {
    const ihDate = intradayHistory?.updated_at?.slice(0, 10)
    const iiDate = investorIntraday?.date
    return ihDate === todayKST || iiDate === todayKST
  }, [intradayHistory, investorIntraday, todayKST])

  // 히스토리 로드
  const [insightsHistory, setInsightsHistory] = useState<InsightsHistory | null>(null)
  const [historyIdx, setHistoryIdx] = useState(-1) // -1 = 라이브/최신
  const [showHistoryMode, setShowHistoryMode] = useState(false)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(import.meta.env.BASE_URL + "data/intraday-insights-history.json?t=" + Date.now())
      if (res.ok) {
        const data: InsightsHistory = await res.json()
        setInsightsHistory(data)
        return data
      }
    } catch { /* ignore */ }
    return null
  }, [])

  // 히스토리 로드 (라이브 모드에서도 이력 버튼 표시를 위해 항상 로드)
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const historySnapshots = insightsHistory?.snapshots ?? []
  const selectedSnapshot = historyIdx >= 0 && historyIdx < historySnapshots.length ? historySnapshots[historyIdx] : null

  // 자정 후 자동으로 히스토리 모드 전환 + 최신 스냅샷 선택
  useEffect(() => {
    if (!isDataFresh && historySnapshots.length > 0 && historyIdx === -1) {
      setHistoryIdx(historySnapshots.length - 1)
    }
  }, [isDataFresh, historySnapshots.length, historyIdx])

  // B-1: Forecast freshness
  const forecastInfo = useMemo(() => {
    if (!themeForecast?.generated_at) return null
    const forecastTime = new Date(themeForecast.generated_at)
    const analysisTime = themeAnalysis?.analyzed_at ? new Date(themeAnalysis.analyzed_at) : null
    const isNewer = analysisTime ? forecastTime > analysisTime : false
    const timeStr = forecastTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
    return { isNewer, timeStr, todayCount: themeForecast.today?.length || 0 }
  }, [themeForecast, themeAnalysis])

  // D-1: Theme momentum — avg intraday change rate per theme
  const themeMomentum = useMemo(() => {
    if (!themeAnalysis?.themes || !intradayHistory?.stocks) return []

    return themeAnalysis.themes.map(theme => {
      const rates: number[] = []
      const stockDetails: { code: string; name: string; rate: number; foreignNet: number | null }[] = []

      for (const stock of theme.leader_stocks) {
        const days = intradayHistory.stocks[stock.code]
        if (!days) continue
        const today = days.find(d => d.date === todayKST)
        if (!today?.intervals_30m?.length) continue
        const latest = today.intervals_30m[today.intervals_30m.length - 1]
        rates.push(latest.change_rate)

        // investor data for this stock
        let foreignNet: number | null = null
        if (investorIntraday?.snapshots?.length) {
          const lastSnap = investorIntraday.snapshots[investorIntraday.snapshots.length - 1]
          foreignNet = lastSnap.data[stock.code]?.f ?? null
        }

        stockDetails.push({ code: stock.code, name: stock.name, rate: latest.change_rate, foreignNet })
      }

      const avg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null
      return { name: theme.theme_name, avgRate: avg, stockCount: theme.leader_stocks.length, dataCount: rates.length, stockDetails }
    }).filter(t => t.avgRate !== null)
  }, [themeAnalysis, intradayHistory, investorIntraday, todayKST])

  // A-1: Momentum shifts — biggest change_rate delta in latest period
  const momentumShifts = useMemo(() => {
    if (!intradayHistory?.stocks) return { gainers: [], losers: [] }

    const items: { code: string; name: string; rate: number; delta: number }[] = []

    for (const [code, days] of Object.entries(intradayHistory.stocks)) {
      const today = days.find(d => d.date === todayKST)
      if (!today?.intervals_30m || today.intervals_30m.length < 2) continue
      const intervals = today.intervals_30m
      const latest = intervals[intervals.length - 1]
      const prev = intervals[intervals.length - 2]
      const delta = latest.change_rate - prev.change_rate
      const name = stockNameMap[code]
      if (!name) continue
      items.push({ code, name, rate: latest.change_rate, delta })
    }

    items.sort((a, b) => b.delta - a.delta)

    return {
      gainers: items.slice(0, 5),
      losers: items.slice(-5).reverse(),
    }
  }, [intradayHistory, todayKST, stockNameMap])

  // 수급-가격 괴리 신호
  const supplyDemandSignals = useMemo(() => {
    if (!investorIntraday?.snapshots?.length) return []
    const lastSnap = investorIntraday.snapshots[investorIntraday.snapshots.length - 1]
    const signals: { code: string; name: string; label: string; rate: number; foreignNet: number; institutionNet: number; programNet: number; strength: "strong" | "normal" }[] = []

    for (const [code, entry] of Object.entries(lastSnap.data)) {
      const name = stockNameMap[code]
      if (!name) continue

      // 등락률: cr 필드 우선, 없으면 intradayHistory에서 가져오기
      let rate = entry.cr ?? null
      if (rate === null || rate === undefined) {
        const days = intradayHistory?.stocks?.[code]
        if (days) {
          const today = days.find(d => d.date === todayKST)
          if (today?.intervals_30m?.length) {
            rate = today.intervals_30m[today.intervals_30m.length - 1].change_rate
          }
        }
      }
      if (rate === null || rate === undefined) continue

      const f = entry.f
      const i = entry.i
      const pg = entry.pg ?? 0

      if (f > 300000 && rate < 0) {
        // 강한 신호: 50만주+ & -5%이하 (백테스트 D+1 승률 67.7%, 초과승률 75.5%)
        const isStrong = f >= 500000 && rate <= -5
        signals.push({ code, name, label: isStrong ? "외국인 대량 저가 매집" : "외국인 저가 매집", rate, foreignNet: f, institutionNet: i, programNet: pg, strength: isStrong ? "strong" : "normal" })
      } else if (f < -300000 && rate > 0) {
        signals.push({ code, name, label: "외국인 차익 실현", rate, foreignNet: f, institutionNet: i, programNet: pg, strength: "normal" })
      } else if (i > 200000 && rate < -1) {
        signals.push({ code, name, label: "기관 저가 매집", rate, foreignNet: f, institutionNet: i, programNet: pg, strength: "normal" })
      }
    }

    // 순매수 절대값 큰 순으로 정렬
    signals.sort((a, b) => Math.max(Math.abs(b.foreignNet), Math.abs(b.institutionNet)) - Math.max(Math.abs(a.foreignNet), Math.abs(a.institutionNet)))
    return signals
  }, [investorIntraday, intradayHistory, stockNameMap, todayKST])

  const hasThemeMomentum = themeMomentum.length > 0
  const hasMovers = momentumShifts.gainers.length > 0
  const hasSupplyDemand = supplyDemandSignals.length > 0
  const hasLiveData = isDataFresh && (hasThemeMomentum || hasMovers || hasSupplyDemand || forecastInfo?.isNewer)
  const hasHistoryData = historySnapshots.length > 0

  // 라이브도 히스토리도 없으면 숨김
  if (!hasLiveData && !hasHistoryData) return null

  // 히스토리 모드이거나 라이브 데이터 없으면 히스토리 표시
  const viewingHistory = showHistoryMode || !isDataFresh
  const snap = viewingHistory ? selectedSnapshot : null

  return (
    <Card className="mb-4 sm:mb-6 shadow-sm border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.03] to-transparent">
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap gap-y-1">
          <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0" />
          <span className="font-semibold text-sm sm:text-base whitespace-nowrap shrink-0">장중 시장 동향</span>
          {!viewingHistory && intradayHistory?.updated_at && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
              {intradayHistory.updated_at.split(" ")[1]?.slice(0, 5)} 기준
            </span>
          )}
          {viewingHistory && snap && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{snap.date} {snap.updated_at.slice(11)} 기준</span>
          )}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {hasHistoryData && (
              <button
                onClick={() => {
                  if (!showHistoryMode) {
                    fetchHistory().then(() => {
                      setShowHistoryMode(true)
                      setHistoryIdx(historySnapshots.length - 1)
                    })
                  } else {
                    setShowHistoryMode(false)
                    setHistoryIdx(-1)
                  }
                }}
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded transition-colors whitespace-nowrap",
                  viewingHistory ? "bg-emerald-500/15 text-emerald-600" : "text-muted-foreground/60 hover:text-muted-foreground"
                )}
              >
                <History className="w-3 h-3 inline mr-0.5" />
                {viewingHistory ? "라이브" : "이력"}
              </button>
            )}
            {viewingHistory && historySnapshots.length > 1 && (
              <>
                <button
                  onClick={() => setHistoryIdx(i => Math.max(0, i - 1))}
                  disabled={historyIdx <= 0}
                  className="p-0.5 text-muted-foreground disabled:opacity-20"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] tabular-nums text-muted-foreground">{historyIdx + 1}/{historySnapshots.length}</span>
                <button
                  onClick={() => setHistoryIdx(i => Math.min(historySnapshots.length - 1, i + 1))}
                  disabled={historyIdx >= historySnapshots.length - 1}
                  className="p-0.5 text-muted-foreground disabled:opacity-20"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* 히스토리 모드 렌더링 */}
        {viewingHistory && snap && (
          <>
            {snap.theme_momentum.length > 0 && (
              <div>
                <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">테마별 장중 등락률 (대장주 평균)</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {snap.theme_momentum.map(t => (
                    <div key={t.name} className="flex items-center justify-between bg-muted/50 rounded-md px-2.5 py-1.5">
                      <span className="text-xs font-medium truncate mr-2">{t.name}</span>
                      <span className={cn("text-xs font-bold tabular-nums shrink-0", t.avg_rate >= 0 ? "text-red-500" : "text-blue-500")}>
                        {t.avg_rate > 0 ? "+" : ""}{t.avg_rate.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(snap.movers.gainers.length > 0 || snap.movers.losers.length > 0) && (
              <div>
                <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">장중 모멘텀 급변 TOP5 (최근 30분 변동폭)</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                  <div>
                    <div className="text-[10px] text-red-500 font-medium mb-1 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />급등 전환</div>
                    {snap.movers.gainers.map(s => (
                      <div key={s.code} className="flex items-center justify-between py-0.5">
                        <span className="text-[11px] truncate mr-1">{s.name}</span>
                        <span className="flex items-center gap-1">
                          <span className={cn("text-[11px] font-bold tabular-nums", s.rate >= 0 ? "text-red-500" : "text-blue-500")}>{s.rate > 0 ? "+" : ""}{s.rate.toFixed(1)}%</span>
                          <span className="text-[10px] text-red-400">({s.delta > 0 ? "+" : ""}{s.delta.toFixed(1)})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-[10px] text-blue-500 font-medium mb-1 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />급락 전환</div>
                    {snap.movers.losers.map(s => (
                      <div key={s.code} className="flex items-center justify-between py-0.5">
                        <span className="text-[11px] truncate mr-1">{s.name}</span>
                        <span className="flex items-center gap-1">
                          <span className={cn("text-[11px] font-bold tabular-nums", s.rate >= 0 ? "text-red-500" : "text-blue-500")}>{s.rate > 0 ? "+" : ""}{s.rate.toFixed(1)}%</span>
                          <span className="text-[10px] text-blue-400">({s.delta.toFixed(1)})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {snap.signals.length > 0 && (
              <div>
                <div className="text-[10px] text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-orange-500" />수급 특이 신호
                </div>
                <div className="space-y-1">
                  {snap.signals.map(s => (
                    <div key={s.code} className="rounded-md px-2.5 py-1.5 bg-orange-500/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400 shrink-0">{s.label}</span>
                          <span className="text-xs truncate">{s.name}</span>
                        </div>
                        <span className={cn("text-xs font-bold tabular-nums shrink-0 ml-2", s.rate >= 0 ? "text-red-500" : "text-blue-500")}>
                          {s.rate > 0 ? "+" : ""}{s.rate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-end mt-0.5">
                        <span className={cn("text-[10px] tabular-nums w-[66px] text-right", s.f > 0 ? "text-red-400" : "text-blue-400")}>외 {s.f > 0 ? "+" : ""}{(s.f / 1000).toFixed(0)}k</span>
                        <span className={cn("text-[10px] tabular-nums w-[52px] text-right", s.i > 0 ? "text-red-400" : "text-blue-400")}>기 {s.i > 0 ? "+" : ""}{(s.i / 1000).toFixed(0)}k</span>
                        <span className={cn("text-[10px] tabular-nums w-[60px] text-right", s.pg > 0 ? "text-red-400" : "text-blue-400")}>프 {s.pg > 0 ? "+" : ""}{(s.pg / 1000).toFixed(0)}k</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!snap.theme_momentum.length && !snap.movers.gainers.length && !snap.signals.length && (
              <p className="text-xs text-muted-foreground text-center py-4">해당 날짜의 데이터가 없습니다</p>
            )}
          </>
        )}

        {/* 라이브 모드 */}
        {!viewingHistory && !isDataFresh && !hasHistoryData && (
          <p className="text-xs text-muted-foreground text-center py-4">장 시작 후 데이터가 수집됩니다</p>
        )}

        {!viewingHistory && isDataFresh && (<>
        {/* B-1: Forecast freshness banner */}
        {forecastInfo?.isNewer && (
          <button
            onClick={onNavigateToForecast}
            className="w-full flex items-center gap-2 bg-amber-500/10 rounded-md px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>AI 장중 재분석 완료 ({forecastInfo.timeStr}) — {forecastInfo.todayCount}개 유망 테마</span>
            <span className="ml-auto text-amber-500 shrink-0">보기 →</span>
          </button>
        )}

        {/* D-1: Theme momentum */}
        {hasThemeMomentum && (
          <div>
            <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">테마별 장중 등락률 (대장주 평균)</div>
            <div className="grid grid-cols-2 gap-1.5">
              {themeMomentum.map(t => (
                <div
                  key={t.name}
                  className="flex items-center justify-between bg-muted/50 rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={(e) => setThemePopup({ name: t.name, stocks: t.stockDetails.map(s => ({ code: s.code, name: s.name, rate: s.rate })), x: e.clientX, y: e.clientY })}
                >
                  <span className="text-xs font-medium truncate mr-2">{t.name}</span>
                  <span className={cn(
                    "text-xs font-bold tabular-nums shrink-0",
                    t.avgRate! >= 0 ? "text-red-500" : "text-blue-500"
                  )}>
                    {t.avgRate! > 0 ? "+" : ""}{t.avgRate!.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* A-1: Momentum shifts */}
        {hasMovers && (
          <div>
            <button
              onClick={() => setShowMovers(!showMovers)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium mb-1 hover:text-foreground transition-colors"
            >
              {showMovers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              장중 모멘텀 급변 TOP5 (최근 30분 변동폭)
            </button>
            {showMovers && (
              <div className="grid grid-cols-2 gap-3">
                {/* Gainers */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-[10px] text-red-500 font-medium mb-0.5">
                    <TrendingUp className="w-3 h-3" /> 급등 전환
                  </div>
                  {momentumShifts.gainers.map(s => (
                    <div key={s.code} className="flex items-center justify-between text-[11px]">
                      <span className="truncate mr-1 cursor-pointer hover:underline" onClick={(e) => setActionPopup({ code: s.code, name: s.name, x: e.clientX, y: e.clientY })}>{s.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={cn("font-bold tabular-nums", s.rate >= 0 ? "text-red-500" : "text-blue-500")}>
                          {s.rate > 0 ? "+" : ""}{s.rate.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-red-400">(+{s.delta.toFixed(1)})</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Losers */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-[10px] text-blue-500 font-medium mb-0.5">
                    <TrendingDown className="w-3 h-3" /> 급락 전환
                  </div>
                  {momentumShifts.losers.map(s => (
                    <div key={s.code} className="flex items-center justify-between text-[11px]">
                      <span className="truncate mr-1 cursor-pointer hover:underline" onClick={(e) => setActionPopup({ code: s.code, name: s.name, x: e.clientX, y: e.clientY })}>{s.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={cn("font-bold tabular-nums", s.rate >= 0 ? "text-red-500" : "text-blue-500")}>
                          {s.rate > 0 ? "+" : ""}{s.rate.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-blue-400">({s.delta.toFixed(1)})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 수급 특이 신호 */}
        {hasSupplyDemand && (
          <div>
            <button
              onClick={(e) => setSignalHelpPopup({ x: e.clientX, y: e.clientY })}
              className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium mb-1.5 hover:text-foreground transition-colors"
            >
              <ShieldAlert className="w-3 h-3 text-orange-500" />
              수급 특이 신호
            </button>
            <div className="space-y-1">
              {supplyDemandSignals.map(s => (
                <div
                  key={s.code}
                  onClick={(e) => setActionPopup({ code: s.code, name: s.name, x: e.clientX, y: e.clientY })}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 transition-colors cursor-pointer",
                    s.strength === "strong"
                      ? "bg-amber-500/10 hover:bg-amber-500/15 ring-1 ring-amber-500/20"
                      : "bg-orange-500/5 hover:bg-orange-500/10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cn(
                        "text-[10px] font-medium shrink-0",
                        s.strength === "strong"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-orange-600 dark:text-orange-400"
                      )}>{s.label}</span>
                      <span className="text-xs truncate">{s.name}</span>
                    </div>
                    <span className={cn("text-xs font-bold tabular-nums shrink-0 ml-2", s.rate >= 0 ? "text-red-500" : "text-blue-500")}>
                      {s.rate > 0 ? "+" : ""}{s.rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-end mt-0.5">
                    <span className={cn("text-[10px] tabular-nums w-[66px] text-right", s.foreignNet === 0 ? "text-muted-foreground/50" : s.foreignNet > 0 ? "text-red-400" : "text-blue-400")}>
                      외 {s.foreignNet > 0 ? "+" : ""}{(s.foreignNet / 1000).toFixed(0)}k
                    </span>
                    <span className={cn("text-[10px] tabular-nums w-[52px] text-right", s.institutionNet === 0 ? "text-muted-foreground/50" : s.institutionNet > 0 ? "text-red-400" : "text-blue-400")}>
                      기 {s.institutionNet > 0 ? "+" : ""}{(s.institutionNet / 1000).toFixed(0)}k
                    </span>
                    <span className={cn("text-[10px] tabular-nums w-[60px] text-right", s.programNet === 0 ? "text-muted-foreground/50" : s.programNet > 0 ? "text-red-400" : "text-blue-400")}>
                      프 {s.programNet > 0 ? "+" : ""}{(s.programNet / 1000).toFixed(0)}k
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        </>)}

        {/* 종목 클릭 액션 팝업 */}
        {actionPopup && (
          <div className="fixed inset-0 z-50" onClick={() => setActionPopup(null)}>
            <div
              className="fixed bg-card border rounded-lg shadow-lg py-1 w-44"
              style={{
                left: Math.min(actionPopup.x, window.innerWidth - 180),
                top: Math.min(actionPopup.y + 4, window.innerHeight - 100),
              }}
              onClick={e => e.stopPropagation()}
            >
              <a
                href={`https://www.tossinvest.com/stocks/A${actionPopup.code}/order`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors"
                onClick={() => setActionPopup(null)}
              >
                <ExternalLink className="w-4 h-4 text-emerald-500" />
                네이버 보기
              </a>
              {onScrollToStock && (
                <button
                  className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors w-full"
                  onClick={() => { onScrollToStock(actionPopup.code); setActionPopup(null) }}
                >
                  <Send className="w-4 h-4 text-blue-500" />
                  종목으로 이동
                </button>
              )}
            </div>
          </div>
        )}

        {/* 수급 특이 신호 설명 팝업 */}
        {signalHelpPopup && (
          <div className="fixed inset-0 z-50" onClick={() => setSignalHelpPopup(null)}>
            <div
              className="fixed bg-card border rounded-lg shadow-lg py-2 px-3 w-64"
              style={{
                left: Math.min(signalHelpPopup.x, window.innerWidth - 270),
                top: Math.min(signalHelpPopup.y + 4, window.innerHeight - 220),
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-xs font-semibold mb-2 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
                수급 특이 신호란?
              </div>
              <div className="space-y-2 text-[11px] text-muted-foreground">
                <div>
                  <span className="font-medium text-amber-600 dark:text-amber-400">외국인 대량 저가 매집</span>
                  <span className="ml-1 text-[9px] text-amber-500 font-bold">강한 신호</span>
                  <p className="mt-0.5">주가 5%+ 하락 중 외국인 순매수 50만주 이상. 백테스트 D+1 초과승률 75.5%.</p>
                </div>
                <div>
                  <span className="font-medium text-orange-600 dark:text-orange-400">외국인 저가 매집</span>
                  <p className="mt-0.5">주가 하락 중 외국인 순매수 30만주 이상. 단독 지표로는 신뢰도 낮음.</p>
                </div>
                <div>
                  <span className="font-medium text-orange-600 dark:text-orange-400">외국인 차익 실현</span>
                  <p className="mt-0.5">주가 상승 중 외국인 순매도 30만주 이상. 고점 매도 가능성.</p>
                </div>
                <div>
                  <span className="font-medium text-orange-600 dark:text-orange-400">기관 저가 매집</span>
                  <p className="mt-0.5">주가 1%+ 하락 중 기관 순매수 20만주 이상. 기관 저점 매수 가능성.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 테마 종목 팝업 */}
        {themePopup && (
          <div className="fixed inset-0 z-50" onClick={() => setThemePopup(null)}>
            <div
              className="fixed bg-card border rounded-lg shadow-lg py-1.5 w-48"
              style={{
                left: Math.min(themePopup.x, window.innerWidth - 200),
                top: Math.min(themePopup.y + 4, window.innerHeight - themePopup.stocks.length * 28 - 40),
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-3 py-1 text-xs font-semibold border-b border-border/50 mb-1">{themePopup.name}</div>
              {themePopup.stocks.map(s => (
                <div
                  key={s.code}
                  className="flex items-center justify-between px-3 py-0.5 text-xs cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => { onScrollToStock?.(s.code); setThemePopup(null) }}
                >
                  <span className="truncate mr-2">{s.name}</span>
                  <span className={cn("tabular-nums shrink-0 font-medium", s.rate >= 0 ? "text-red-500" : "text-blue-500")}>
                    {s.rate > 0 ? "+" : ""}{s.rate.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
