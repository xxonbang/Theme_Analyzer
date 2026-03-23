import { useEffect, useState } from "react"
import { Loader2, LineChart, RotateCcw, CheckCheck, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { PaperTradingStockCard } from "@/components/PaperTradingStockCard"
import { PaperTradingSummary } from "@/components/PaperTradingSummary"
import { PaperTradingDateSelector } from "@/components/PaperTradingDateSelector"
import { TakeProfitSlider, applyTPSL, type TPSLValues } from "@/components/TakeProfitSlider"
import { usePaperTradingData, calcEqualWeightSummary, calcEqualDayProfitRate } from "@/hooks/usePaperTradingData"
import { useInvestorIntraday } from "@/hooks/useInvestorIntraday"
import { cn } from "@/lib/utils"
import type { PaperTradingData, PaperTradingMode, InvestMode } from "@/types/stock"

export function PaperTradingPage() {
  const {
    index,
    loading,
    error,
    selectedDates,
    dailyData,
    adjustedDailyData,
    selectedSnapshotIndex,
    summary,
    fetchIndex,
    toggleDate,
    toggleAllDates,
    toggleStock,
    toggleAllStocks,
    isStockExcluded,
    excludedStocks,
    resetExcluded,
    selectBuyTimestamp,
    activeStocks,
  } = usePaperTradingData()

  const { data: intradayData } = useInvestorIntraday()
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<PaperTradingMode>("close")
  const [investMode, setInvestMode] = useState<InvestMode>("equal")

  // 익절/손절 시뮬레이션 state
  const TPSL_OFF: TPSLValues = { tp: null, sl: null }
  const [globalTPSL, setGlobalTPSL] = useState<TPSLValues>(TPSL_OFF)
  const [dateTPSL, setDateTPSL] = useState<Record<string, TPSLValues>>({})
  const [stockTPSL, setStockTPSL] = useState<Record<string, TPSLValues>>({})

  /** 종목의 실효 TPSL (종목별 > 날짜별 > 글로벌) */
  const getEffectiveTPSL = (date: string, code: string): TPSLValues => {
    const sk = `${date}:${code}`
    const stock = stockTPSL[sk]
    const day = dateTPSL[date]
    return {
      tp: stock?.tp ?? day?.tp ?? globalTPSL.tp,
      sl: stock?.sl ?? day?.sl ?? globalTPSL.sl,
    }
  }


  const handleModeChange = (mode: PaperTradingMode) => {
    setActiveTab(mode)
  }

  useEffect(() => {
    fetchIndex()
  }, [fetchIndex])

  const toggleCollapse = (date: string) => {
    setCollapsedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }

  if (loading && index.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">모의투자 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 선택된 날짜의 데이터를 날짜순으로 정렬 (adjustedDailyData로 렌더링)
  const selectedDailyData: { date: string; data: PaperTradingData }[] = []
  for (const date of Array.from(selectedDates).sort((a, b) => b.localeCompare(a))) {
    const data = adjustedDailyData.get(date)
    if (data) {
      selectedDailyData.push({ date, data })
    }
  }

  const displaySummary = investMode === "equal"
    ? calcEqualWeightSummary(activeStocks, selectedDates.size)
    : summary

  // 글로벌 TPSL 시뮬레이션 수익률
  const globalSimRate = (() => {
    if (globalTPSL.tp === null && globalTPSL.sl === null) return null
    const stocks = activeStocks
    if (stocks.length === 0) return null
    const totalRate = stocks.reduce((sum, s) => sum + applyTPSL(s.profit_rate, s.high_profit_rate, globalTPSL), 0)
    return Math.round(totalRate / stocks.length * 100) / 100
  })()

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 */}
      <div>
        <div className="flex items-center gap-2">
          <LineChart className="w-5 h-5 text-primary shrink-0" />
          <h2 className="font-bold text-base sm:text-lg">AI 대장주 모의투자</h2>
        </div>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 ml-7">
          Gemini 선정 대장주 <span className="font-semibold text-foreground">{investMode === "equal" ? "동일금액(100만)" : "1주씩"}</span> 매수 → <span className="font-semibold text-foreground">{activeTab === "close" ? "장마감 종가" : "장중 최고가"}</span> 매도
        </p>
      </div>

      {/* 투자방식 + 매도기준 탭 */}
      <div className="flex items-center gap-3">
        {/* 투자방식 탭 */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest shrink-0">매수</span>
          <div className="flex rounded-lg bg-muted p-0.5 gap-0.5">
            <button
              onClick={() => setInvestMode("equal")}
              className={cn(
                "w-[4.5rem] sm:w-20 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-150 text-center",
                investMode === "equal"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              동일금액
            </button>
            <button
              onClick={() => setInvestMode("single")}
              className={cn(
                "w-[4.5rem] sm:w-20 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-150 text-center",
                investMode === "single"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              1주
            </button>
          </div>
        </div>
        {/* 매도 기준 탭 */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest shrink-0">매도</span>
          <div className="flex rounded-lg bg-muted p-0.5 gap-0.5">
            <button
              onClick={() => handleModeChange("close")}
              className={cn(
                "w-[4.5rem] sm:w-20 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-150 text-center",
                activeTab === "close"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              종가
            </button>
            <button
              onClick={() => handleModeChange("high")}
              className={cn(
                "w-[4.5rem] sm:w-20 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-150 text-center",
                activeTab === "high"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              최고가
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* 장중 실시간 손익 */}
      {intradayData && intradayData.snapshots?.length > 0 && selectedDailyData.length > 0 && (() => {
        const todayStr = intradayData.date
        const todayData = adjustedDailyData.get(todayStr)
        if (!todayData || !selectedDates.has(todayStr)) return null
        const lastSnap = intradayData.snapshots[intradayData.snapshots.length - 1]
        const snapData = lastSnap.data || {}
        const activeForToday = todayData.stocks.filter(s => !isStockExcluded(todayStr, s.code))
        const realtimeItems = activeForToday
          .map(s => {
            const cp = snapData[s.code]?.cp
            if (!cp || !s.buy_price) return null
            const pnlRate = Math.round(((cp - s.buy_price) / s.buy_price) * 10000) / 100
            return { name: s.name, code: s.code, buyPrice: s.buy_price, currentPrice: cp, pnlRate }
          })
          .filter(Boolean) as Array<{ name: string; code: string; buyPrice: number; currentPrice: number; pnlRate: number }>
        if (realtimeItems.length === 0) return null
        const avgPnl = Math.round(realtimeItems.reduce((s, i) => s + i.pnlRate, 0) / realtimeItems.length * 100) / 100
        return (
          <Card className="overflow-hidden shadow-sm border-amber-500/30">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-semibold">장중 실시간 ({lastSnap.time})</span>
                <span className={cn("font-bold text-sm tabular-nums", avgPnl > 0 ? "text-red-600" : avgPnl < 0 ? "text-blue-600" : "")}>
                  평균 {avgPnl >= 0 ? "+" : ""}{avgPnl}%
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {realtimeItems.map(item => (
                  <div key={item.code} className="flex items-center justify-between text-[10px] sm:text-xs px-2 py-1 rounded bg-muted/30">
                    <span className="truncate mr-1">{item.name}</span>
                    <span className={cn("font-semibold tabular-nums shrink-0", item.pnlRate > 0 ? "text-red-600" : item.pnlRate < 0 ? "text-blue-600" : "")}>
                      {item.pnlRate >= 0 ? "+" : ""}{item.pnlRate}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* 종합 요약 + 글로벌 익절 슬라이더 */}
      {selectedDailyData.length > 0 && (
        <PaperTradingSummary summary={displaySummary} mode={activeTab}>
          <TakeProfitSlider
            value={globalTPSL}
            onChange={setGlobalTPSL}
            label="전체"
            simulatedRate={globalSimRate ?? undefined}
            originalRate={activeTab === "high" ? displaySummary.highTotalProfitRate : displaySummary.totalProfitRate}
          />
        </PaperTradingSummary>
      )}

      {/* 날짜 선택 */}
      <Card className="overflow-hidden shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <PaperTradingDateSelector
            entries={index}
            selectedDates={selectedDates}
            dailyData={adjustedDailyData}
            isStockExcluded={isStockExcluded}
            onToggleDate={toggleDate}
            onToggleAll={toggleAllDates}
            mode={activeTab}
            investMode={investMode}
          />
        </CardContent>
      </Card>

      {/* 일별 종목 카드 */}
      {selectedDailyData.map(({ date, data }) => {
        const collapsed = collapsedDates.has(date)
        const activeStocksForDay = data.stocks.filter(s => !isStockExcluded(date, s.code))
        const dayProfitRate = investMode === "equal"
          ? calcEqualDayProfitRate(activeStocksForDay, activeTab)
          : (() => {
              const inv = activeStocksForDay.reduce((sum, s) => sum + s.buy_price, 0)
              const val = activeTab === "high"
                ? activeStocksForDay.reduce((sum, s) => sum + (s.high_price ?? s.close_price), 0)
                : activeStocksForDay.reduce((sum, s) => sum + s.close_price, 0)
              return inv > 0 ? Math.round(((val - inv) / inv) * 10000) / 100 : 0
            })()
        const rawData = dailyData.get(date)
        const snapshots = rawData?.price_snapshots
        const currentSnapIdx = selectedSnapshotIndex.get(date) ?? 0
        // 날짜별 익절 시뮬레이션
        const dayEffTPSL: TPSLValues = {
          tp: dateTPSL[date]?.tp ?? globalTPSL.tp,
          sl: dateTPSL[date]?.sl ?? globalTPSL.sl,
        }
        const daySimRate = (dayEffTPSL.tp !== null || dayEffTPSL.sl !== null) && activeStocksForDay.length > 0
          ? Math.round(activeStocksForDay.reduce((sum, s) => sum + applyTPSL(s.profit_rate, s.high_profit_rate, dayEffTPSL), 0) / activeStocksForDay.length * 100) / 100
          : null
        return (
          <Card key={date} className="overflow-hidden shadow-sm">
            <CardContent className="p-3 sm:p-4 space-y-3">
              {/* 일별 헤더 */}
              <div className="flex flex-wrap items-center justify-between gap-y-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCollapse(date)}
                    className="flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    {collapsed ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="font-semibold text-sm sm:text-base">
                      {date.replace(/-/g, ".")}
                    </span>
                  </button>
                  <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                    {activeStocksForDay.length}/{data.stocks.length}종목
                  </span>
                  {snapshots && snapshots.length > 1 ? (
                    <select
                      value={currentSnapIdx}
                      onChange={(e) => selectBuyTimestamp(date, Number(e.target.value))}
                      className="text-[10px] sm:text-xs bg-muted/50 border border-border rounded px-1.5 py-0.5 text-foreground"
                    >
                      {snapshots.map((snap, idx) => {
                        const time = snap.timestamp.split(" ")[1]?.slice(0, 5) ?? snap.timestamp
                        return (
                          <option key={idx} value={idx}>
                            매수 {time}
                          </option>
                        )
                      })}
                    </select>
                  ) : (
                    (() => {
                      const t = data.morning_timestamp?.split(" ")[1]?.slice(0, 5)
                      return t ? (
                        <span className="text-[10px] sm:text-xs bg-muted/50 border border-border rounded px-1.5 py-0.5 text-foreground inline-block">
                          매수 {t}
                        </span>
                      ) : null
                    })()
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!collapsed && (
                    <button
                      onClick={() => toggleAllStocks(date, data.stocks.map(s => s.code))}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-md text-xs",
                        "transition-colors duration-150",
                        "hover:bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      {data.stocks.every(s => isStockExcluded(date, s.code)) ? "전체 선택" : "전체 해제"}
                    </button>
                  )}
                  <div className={cn(
                    "font-bold text-sm sm:text-base tabular-nums",
                    dayProfitRate > 0 && "text-red-600",
                    dayProfitRate < 0 && "text-blue-600",
                  )}>
                    {dayProfitRate >= 0 ? "+" : ""}{dayProfitRate}%
                  </div>
                </div>
              </div>

              {!collapsed && (
                <>
                  {/* 날짜별 익절 슬라이더 */}
                  <TakeProfitSlider
                    value={dateTPSL[date] ?? TPSL_OFF}
                    onChange={(v) => setDateTPSL(prev => ({ ...prev, [date]: v }))}
                    label="날짜"
                    simulatedRate={daySimRate ?? undefined}
                    originalRate={dayProfitRate}
                    compact
                  />

                  <hr className="border-border/50" />

                  {/* 종목 카드 그리드 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {data.stocks.map(stock => (
                      <PaperTradingStockCard
                        key={`${date}-${stock.code}`}
                        stock={stock}
                        date={date}
                        isExcluded={isStockExcluded(date, stock.code)}
                        onToggle={toggleStock}
                        morningTimestamp={data.morning_timestamp}
                        mode={activeTab}
                        investMode={investMode}
                        tpsl={getEffectiveTPSL(date, stock.code)}
                        onTPSLChange={(v) => setStockTPSL(prev => ({ ...prev, [`${date}:${stock.code}`]: v }))}
                      />
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* 제외된 종목 초기화 */}
      {excludedStocks.size > 0 && (
        <div className="flex justify-center">
          <button
            onClick={resetExcluded}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md",
              "text-xs sm:text-sm text-muted-foreground",
              "hover:bg-muted transition-colors duration-150",
            )}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            제외된 종목 {excludedStocks.size}개 초기화
          </button>
        </div>
      )}

      {/* 빈 상태 */}
      {index.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <LineChart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">아직 모의투자 데이터가 없습니다.</p>
          <p className="text-xs mt-1">매일 15:40에 자동으로 수집됩니다.</p>
        </div>
      )}
    </div>
  )
}
