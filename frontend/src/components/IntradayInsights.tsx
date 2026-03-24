import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Activity, Sparkles, TrendingUp, TrendingDown, ChevronDown, ChevronUp, ShieldAlert, ExternalLink, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ThemeAnalysis, IntradayHistoryData, InvestorIntraday, ThemeForecast } from "@/types/stock"

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
  const [showMovers, setShowMovers] = useState(false)
  const [actionPopup, setActionPopup] = useState<{ code: string; name: string; x: number; y: number } | null>(null)
  const [themePopup, setThemePopup] = useState<{ name: string; stocks: { code: string; name: string; rate: number }[]; x: number; y: number } | null>(null)
  const [signalHelpPopup, setSignalHelpPopup] = useState<{ x: number; y: number } | null>(null)
  const todayKST = useMemo(getTodayKST, [])

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
    const signals: { code: string; name: string; label: string; rate: number; foreignNet: number; institutionNet: number; programNet: number }[] = []

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
        signals.push({ code, name, label: "외국인 저가 매집", rate, foreignNet: f, institutionNet: i, programNet: pg })
      } else if (f < -300000 && rate > 0) {
        signals.push({ code, name, label: "외국인 차익 실현", rate, foreignNet: f, institutionNet: i, programNet: pg })
      } else if (i > 200000 && rate < -1) {
        signals.push({ code, name, label: "기관 저가 매집", rate, foreignNet: f, institutionNet: i, programNet: pg })
      }
    }

    // 순매수 절대값 큰 순으로 정렬
    signals.sort((a, b) => Math.max(Math.abs(b.foreignNet), Math.abs(b.institutionNet)) - Math.max(Math.abs(a.foreignNet), Math.abs(a.institutionNet)))
    return signals
  }, [investorIntraday, intradayHistory, stockNameMap, todayKST])

  const hasThemeMomentum = themeMomentum.length > 0
  const hasMovers = momentumShifts.gainers.length > 0
  const hasSupplyDemand = supplyDemandSignals.length > 0
  if (!hasThemeMomentum && !hasMovers && !hasSupplyDemand && !forecastInfo?.isNewer) return null

  return (
    <Card className="mb-4 sm:mb-6 shadow-sm border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.03] to-transparent">
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
          <span className="font-semibold text-sm sm:text-base">장중 시장 동향</span>
          {intradayHistory?.updated_at && (
            <span className="text-[10px] text-muted-foreground">
              {intradayHistory.updated_at.split(" ")[1]?.slice(0, 5)} 기준
            </span>
          )}
        </div>

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
                        <span className="text-[9px] text-red-400">(+{s.delta.toFixed(1)})</span>
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
                        <span className="text-[9px] text-blue-400">({s.delta.toFixed(1)})</span>
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
                  className="bg-orange-500/5 rounded-md px-2.5 py-1.5 hover:bg-orange-500/10 transition-colors cursor-pointer"
                >
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
                href={`https://m.stock.naver.com/domestic/stock/${actionPopup.code}/total`}
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
                  <span className="font-medium text-orange-600 dark:text-orange-400">외국인 저가 매집</span>
                  <p className="mt-0.5">주가 하락 중 외국인 순매수 30만주 이상. 저점 매수 가능성.</p>
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
