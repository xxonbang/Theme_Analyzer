import { useState, useEffect, Fragment, memo } from "react"
import { TrendingUp, TrendingDown, ExternalLink, Newspaper, ChevronDown, ChevronUp, Crown, Maximize2, Banknote, Users, Building2, BarChart3, Sparkles, HelpCircle } from "lucide-react"
import { getMarketElapsedRatio, calculateVwap, calculateRvol, calculateRank30, calculateConcentration } from "@/lib/market-metrics"
import { MetricsInfoModal, type MetricsPopupType } from "@/components/MetricsInfoModal"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatPrice, formatVolume, formatChangeRate, formatTradingValue, getChangeBgColor, formatNetBuy, getNetBuyColor } from "@/lib/utils"
import { CRITERIA_CONFIG, GOLDEN_CROSS_LABELS } from "@/lib/criteria"
import { getInvestorScheduleInfo } from "@/lib/investor-schedule"
import { CriteriaPopup } from "@/components/CriteriaPopup"
import { PriceHistoryPopup } from "@/components/PriceHistoryPopup"
import { TradingChartPopup } from "@/components/TradingChartPopup"
import { InvestorChartPopup } from "@/components/InvestorChartPopup"
import { InvestorSchedulePopup } from "@/components/InvestorSchedulePopup"
import { Sparkline } from "@/components/Sparkline"
import { VolumeProfilePopup } from "@/components/VolumeProfilePopup"
import { MemberChartPopup } from "@/components/MemberChartPopup"
import DistributionPopup from "@/components/DistributionPopup"
import type { Stock, StockHistory, StockNews, InvestorInfo, MemberInfo, StockCriteria, InvestorIntraday, StockVolumeProfile, IntradayDay, FundamentalInfo } from "@/types/stock"

interface StockCardProps {
  stock: Stock
  history?: StockHistory
  news?: StockNews
  type: "rising" | "falling" | "neutral"
  investorInfo?: InvestorInfo
  investorEstimated?: boolean
  investorUpdatedAt?: string
  memberInfo?: MemberInfo
  criteria?: StockCriteria
  investorIntraday?: InvestorIntraday
  isAdmin?: boolean
  dataTimestamp?: string
  volumeProfile?: StockVolumeProfile
  vpUpdatedAt?: string
  intradayDays?: IntradayDay[]
  fundamental?: FundamentalInfo
}

export const StockCard = memo(function StockCard({ stock, history, news, type, investorInfo, investorEstimated, investorUpdatedAt, memberInfo, criteria, investorIntraday, isAdmin, dataTimestamp, volumeProfile, vpUpdatedAt, intradayDays, fundamental }: StockCardProps) {
  const [isNewsExpanded, setIsNewsExpanded] = useState(false)
  const [showRankTip, setShowRankTip] = useState(false)
  const [metricsPopup, setMetricsPopup] = useState<MetricsPopupType | null>(null)
  useEffect(() => { if (showRankTip) { const t = setTimeout(() => setShowRankTip(false), 2000); return () => clearTimeout(t) } }, [showRankTip])
  const [showCriteriaPopup, setShowCriteriaPopup] = useState(false)
  const [showPriceHistory, setShowPriceHistory] = useState(false)
  const [showTradingChart, setShowTradingChart] = useState(false)
  const [showInvestorChart, setShowInvestorChart] = useState(false)
  const [showVolumeProfile, setShowVolumeProfile] = useState(false)
  const [showMemberChart, setShowMemberChart] = useState(false)
  const [showDistribution, setShowDistribution] = useState(false)
  const hasMemberData = !!(memberInfo && (memberInfo.buy_top5.length > 0 || memberInfo.sell_top5.length > 0))
  const hasVpData = !!volumeProfile
  const [vpExpanded, setVpExpanded] = useState(hasVpData)
  const [showSchedule, setShowSchedule] = useState(false)
  const [isTradingHistoryExpanded, setIsTradingHistoryExpanded] = useState(false)
  const [isInvestorHistoryExpanded, setIsInvestorHistoryExpanded] = useState(false)
  const [gcExpanded, setGcExpanded] = useState(!!criteria?.golden_cross?.met)
  const [memberExpanded, setMemberExpanded] = useState(hasMemberData)
  const [selectedGcKey, setSelectedGcKey] = useState<string | null>(null)
  const effectiveType = type === "neutral" ? (stock.change_rate >= 0 ? "rising" : "falling") : type
  const isRising = effectiveType === "rising"
  const TrendIcon = isRising ? TrendingUp : TrendingDown
  const tossUrl = `https://www.tossinvest.com/stocks/A${stock.code}/order`

  // VWAP / RVOL / 30일 순위 / 거래 집중 — 공통 모듈로 계산.
  // 데이터 단위: stock.volume = KRX 단독(J). cutoff 5/31 후 stock-history(UN) 단위와 불일치 가능 (main.py UN 마이그레이션 필요 — 별도 작업).
  const { vwap, vwapDiffPct } = calculateVwap(stock.trading_value ?? 0, stock.volume ?? 0, stock.current_price)
  const changes = history?.changes ?? []
  const currentVol = stock.volume ?? 0
  const recent20 = changes.slice(1, 21).map(c => c.volume ?? 0).filter(v => v > 0)
  const rvol = calculateRvol(currentVol, recent20, getMarketElapsedRatio())
  const historicalVols30 = changes.slice(1, 30).map(c => c.volume ?? 0).filter(v => v > 0)
  const { rank: rank30, total: rank30Total } = calculateRank30(currentVol, historicalVols30)
  const concentration = calculateConcentration(volumeProfile?.today?.bins)
  const hasNews = news && news.news && news.news.length > 0
  const allMet = criteria?.all_met ?? false
  const shortWarning = isAdmin && criteria?.short_selling?.met
  const overheatWarning = isAdmin && criteria?.overheating?.met
  const reverseWarning = isAdmin && criteria?.reverse_alignment?.met
  const showCriteria = isAdmin && criteria

  const handleDotClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowCriteriaPopup(true)
  }

  return (
    <Card id={`stock-${stock.code}`} className={cn(
      "group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 hover:border-primary/30 bg-card relative",
      allMet && isAdmin
        ? "ring-2 ring-yellow-400/70 animate-shimmer"
        : ""
    )}>
      {/* 경고 알림 뱃지 */}
      {isAdmin && (shortWarning || overheatWarning || reverseWarning) && (
        <div className="absolute -top-1.5 -right-1.5 z-10 flex gap-0.5">
          {shortWarning && <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-card animate-pulse" title="공매도 경고" />}
          {overheatWarning && <span className="w-3 h-3 rounded-full bg-amber-500 border-2 border-card animate-pulse" title="과열 경고" />}
          {reverseWarning && <span className="w-3 h-3 rounded-full bg-indigo-500 border-2 border-card animate-pulse" title="역배열 경고" />}
        </div>
      )}
      <CardContent className="p-3 sm:p-4">
        {/* Header: Rank + Name + Price */}
        <div className="flex items-start justify-between gap-2">
          {/* Left: Rank + Name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="relative shrink-0">
              <button
                onClick={() => setShowRankTip(v => !v)}
                className={cn(
                  "flex items-center justify-center rounded-full font-bold",
                  stock.rank <= 3
                    ? "w-7 h-7 sm:w-9 sm:h-9 text-xs sm:text-sm ring-1"
                    : "w-6 h-6 sm:w-8 sm:h-8 text-xs sm:text-sm",
                  stock.rank === 1 && "bg-amber-500/15 text-amber-600 ring-amber-400/40",
                  stock.rank === 2 && "bg-slate-400/15 text-slate-500 ring-slate-400/30",
                  stock.rank === 3 && "bg-orange-400/15 text-orange-600 ring-orange-400/30",
                  stock.rank > 3 && (isRising ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600")
                )}>
                {stock.rank}
              </button>
              {showRankTip && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 px-2.5 py-1.5 bg-popover text-popover-foreground text-[10px] font-medium rounded-md shadow-lg border border-border whitespace-nowrap animate-in fade-in-0 zoom-in-95 duration-150">
                  {stock.rank <= 3 ? (
                    <span>{stock.rank === 1 ? "🥇 금" : stock.rank === 2 ? "🥈 은" : "🥉 동"} · TOP3</span>
                  ) : (
                    <span>{stock.rank}위 · {isRising ? "상승" : "하락"}</span>
                  )}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-l border-t border-border rotate-45" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <a
                href={tossUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-sm sm:text-base text-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <span>{stock.name}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:block" />
              </a>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">{stock.code}</p>

              {/* 기준 인디케이터 (admin만 표시) */}
              {showCriteria && (
                <div className="relative flex items-center gap-1 mt-0.5 flex-wrap">
                  {CRITERIA_CONFIG.map(({ key, dot, badge, label, shortLabel }) => {
                    const criterion = criteria[key as keyof StockCriteria]
                    if (typeof criterion === "boolean") return null
                    if (!criterion?.met) return null
                    if (criterion?.warning) return null

                    const is52w = key === "high_breakout" && criterion?.is_52w_high

                    return (
                      <Fragment key={key}>
                        {/* 모바일: 도트 */}
                        <button
                          onClick={(e) => handleDotClick(e)}
                          className={cn(
                            "w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer sm:hidden",
                            "transition-transform hover:scale-125 shadow-sm",
                            dot
                          )}
                          title={label}
                        />
                        {is52w && (
                          <button
                            onClick={(e) => handleDotClick(e)}
                            className="shrink-0 cursor-pointer sm:hidden transition-transform hover:scale-125"
                            title="52주 신고가"
                          >
                            <Crown className="w-3 h-3 text-amber-500" />
                          </button>
                        )}
                        {/* PC/태블릿: 뱃지 */}
                        <button
                          onClick={(e) => handleDotClick(e)}
                          className={cn(
                            "hidden sm:inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium cursor-pointer",
                            "transition-opacity hover:opacity-80",
                            badge
                          )}
                        >
                          {is52w ? <Crown className="w-3 h-3 text-amber-500" /> : <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />}
                          {is52w ? "52주 신고가" : shortLabel}
                        </button>
                      </Fragment>
                    )
                  })}

                  {/* 팝업 */}
                  {showCriteriaPopup && (
                    <CriteriaPopup stockName={stock.name} criteria={criteria} onClose={() => setShowCriteriaPopup(false)} />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Price + Change */}
          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1">
              {isAdmin && history?.raw_daily_prices && history.raw_daily_prices.length > 20 && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDistribution(true) }}
                  className="text-[10px] px-1 py-0.5 rounded bg-violet-500/10 text-violet-500 hover:bg-violet-500/20 transition-colors font-medium"
                >
                  정규분포
                </button>
              )}
              <p className="font-bold text-sm sm:text-base tabular-nums">
                {formatPrice(stock.current_price)}
                <span className="text-muted-foreground text-[10px] sm:text-xs ml-0.5">원</span>
              </p>
            </div>
            <div className="flex items-center justify-end gap-1">
              {/* D-2, D-1 등락률 (클릭하면 10일 팝업) */}
              {history && history.changes && history.changes.length > 0 && (() => {
                const reversed = [...history.changes].reverse()
                const pastDays = reversed.slice(0, -1)
                // 최근 2일만 표시 (나머지는 팝업에서)
                return pastDays.slice(-2).map((change, idx) => {
                  const offset = pastDays.length - 2 + idx
                  const dayNum = pastDays.length - offset
                  return (
                    <button
                      key={idx}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPriceHistory(true) }}
                      className={cn(
                        "text-[10px] px-0.5 rounded font-medium whitespace-nowrap tabular-nums cursor-pointer hover:opacity-70 transition-opacity",
                        getChangeBgColor(change.change_rate)
                      )}
                    >
                      D-{dayNum} {change.change_rate > 0 ? "+" : ""}{change.change_rate.toFixed(1)}%
                    </button>
                  )
                })
              })()}
              <Badge
                variant={isRising ? "rising" : "falling"}
                className={cn("text-[10px] sm:text-xs px-1.5 sm:px-2", history?.changes && "cursor-pointer hover:opacity-70 transition-opacity")}
                onClick={(e: React.MouseEvent) => { if (history?.changes) { e.preventDefault(); e.stopPropagation(); setShowPriceHistory(true) } }}
              >
                <TrendIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5" />
                {formatChangeRate(stock.change_rate)}
              </Badge>
            </div>
            {/* 10일 가격 변동 팝업 */}
            {showPriceHistory && history && history.changes && (
              <PriceHistoryPopup
                stockName={stock.name}
                currentPrice={stock.current_price}
                currentChangeRate={stock.change_rate}
                changes={history.changes}
                intradayDays={intradayDays}
                onClose={() => setShowPriceHistory(false)}
              />
            )}
            {/* 분포 분석 팝업 */}
            {showDistribution && history?.raw_daily_prices && (
              <DistributionPopup
                stockName={stock.name}
                currentPrice={stock.current_price}
                rawDailyPrices={history.raw_daily_prices}
                fundamental={fundamental}
                volumeProfile={volumeProfile}
                onClose={() => setShowDistribution(false)}
              />
            )}
          </div>
        </div>

        {/* Volume + History */}
        <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
          {/* 거래 정보 */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Banknote className="w-3.5 h-3.5 text-amber-500/60" />
              <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground/80 tracking-wider">거래</span>
              {dataTimestamp && <span className="text-[10px] text-muted-foreground/70 tabular-nums">{dataTimestamp.slice(11, 16)}</span>}
            </div>
            <div
              className={cn("flex items-center gap-1.5 text-xs", history?.changes && history.changes.length > 1 && "cursor-pointer")}
              onClick={() => history?.changes && history.changes.length > 1 && setIsTradingHistoryExpanded(!isTradingHistoryExpanded)}
            >
              {/* 히스토리 확장 토글 */}
              {history?.changes && history.changes.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsTradingHistoryExpanded(!isTradingHistoryExpanded) }}
                  className="text-muted-foreground hover:text-foreground transition-all"
                >
                  {isTradingHistoryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
              {/* 거래 데이터 */}
              <div className="flex items-center flex-1 min-w-0 gap-1 sm:gap-2">
                {stock.trading_value != null && (
                  <span className="flex-1 flex flex-col items-center whitespace-nowrap bg-muted/30 sm:bg-muted/50 rounded sm:rounded-md px-1.5 py-1 sm:px-3 sm:py-2">
                    <span className="flex items-center gap-0.5 text-[10px] sm:text-xs font-semibold text-foreground/60 leading-tight">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 bg-amber-500" />
                      <span className="sm:hidden">대금</span><span className="hidden sm:inline">거래대금</span>
                    </span>
                    <span className="font-medium tabular-nums text-foreground text-[11px] sm:text-sm leading-tight">{formatTradingValue(stock.trading_value)}</span>
                  </span>
                )}
                <span className="flex-1 flex flex-col items-center whitespace-nowrap bg-muted/30 sm:bg-muted/50 rounded sm:rounded-md px-1.5 py-1 sm:px-3 sm:py-2">
                  <span className="flex items-center gap-0.5 text-[10px] sm:text-xs font-semibold text-foreground/60 leading-tight">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 bg-indigo-500" />
                    <span className="sm:hidden">거래량</span><span className="hidden sm:inline">거래량</span>
                  </span>
                  <span className="font-medium tabular-nums text-foreground text-[11px] sm:text-sm leading-tight">{formatVolume(stock.volume)}</span>
                </span>
              </div>
              {/* 스파크라인 + bottom sheet */}
              {!(history?.changes && history.changes.length > 1) && (
                <span className="text-[10px] text-muted-foreground/50 py-1">거래 이력 부족</span>
              )}
              {history?.changes && history.changes.length > 1 && (() => {
                const reversed = [...history.changes].slice(0, 11).reverse()
                const tradingSparkData = reversed.map((c, i) =>
                  i === reversed.length - 1 ? (stock.trading_value ?? c.trading_value ?? 0) : (c.trading_value ?? 0)
                )
                return (
                <div className="flex items-center shrink-0 rounded-md border border-border/50 overflow-hidden">
                  <button onClick={(e) => { e.stopPropagation(); setShowTradingChart(true) }} className="px-1.5 py-1 opacity-70 hover:opacity-100 hover:bg-muted/50 transition-all cursor-pointer">
                    <Sparkline data={tradingSparkData} color="#f59e0b" className="pointer-events-none" />
                  </button>
                  <div className="w-px self-stretch bg-border/50" />
                  <button onClick={(e) => { e.stopPropagation(); setShowTradingChart(true) }} className="px-1.5 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </div>
                )
              })()}
            </div>

            {/* VWAP / RVOL / 30일 순위 / 거래 집중 */}
            {(vwap !== null || rvol !== null || rank30 !== null) && (
              <div className="mt-1.5 pt-1.5 border-t border-border/40 space-y-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                  {vwap !== null && (
                    <span className="inline-flex items-center gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMetricsPopup("vwap") }}
                        className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                        aria-label="VWAP 설명 보기"
                      >
                        VWAP
                        <HelpCircle className="w-2.5 h-2.5 opacity-60" />
                      </button>{" "}
                      <span className="font-medium text-foreground/85 tabular-nums">{formatPrice(Math.round(vwap))}원</span>
                      {vwapDiffPct !== null && (
                        <span className={cn("ml-1 font-medium tabular-nums", vwapDiffPct >= 0 ? "text-red-500" : "text-blue-500")}>
                          ({vwapDiffPct >= 0 ? "+" : ""}{vwapDiffPct.toFixed(2)}%)
                        </span>
                      )}
                    </span>
                  )}
                  {rvol !== null && (
                    <span className="inline-flex items-center gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMetricsPopup("rvol") }}
                        className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                        aria-label="RVOL 설명 보기"
                      >
                        RVOL
                        <HelpCircle className="w-2.5 h-2.5 opacity-60" />
                      </button>{" "}
                      <span className={cn("font-medium tabular-nums",
                        rvol >= 2 ? "text-red-500" : rvol >= 1.2 ? "text-amber-500" : "text-foreground/85")}>
                        {rvol.toFixed(2)}x
                      </span>
                    </span>
                  )}
                  {rank30 !== null && rank30Total !== null && (
                    <span className="inline-flex items-center gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMetricsPopup("rank30") }}
                        className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                        aria-label="30일 순위 설명 보기"
                      >
                        30일 순위
                        <HelpCircle className="w-2.5 h-2.5 opacity-60" />
                      </button>{" "}
                      <span className={cn("font-medium tabular-nums",
                        rank30 === 1 ? "text-red-500 font-bold"
                          : rank30 <= 3 ? "text-red-500"
                          : rank30 <= 15 ? "text-foreground/85"
                          : "text-muted-foreground")}>
                        {rank30}위
                      </span>
                      <span className="ml-0.5 text-[9px] text-muted-foreground/60 tabular-nums">
                        {rank30 === 1 ? "(최고)" : `(상위 ${Math.round((rank30 / rank30Total) * 100)}%)`}
                      </span>
                    </span>
                  )}
                </div>
                {concentration && concentration.length > 0 && (
                  <div className="text-[10px] text-muted-foreground/80">
                    <span className="text-muted-foreground">거래 집중</span>
                    {" "}
                    <span className="tabular-nums">
                      {concentration.map((c, i) => (
                        <span key={i}>
                          {i > 0 && <span className="mx-1 text-muted-foreground/40">·</span>}
                          {formatPrice(c.price)}원
                          <span className="ml-0.5 text-muted-foreground/60">({c.pct.toFixed(0)}%)</span>
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 거래 차트 팝업 */}
            {showTradingChart && history?.changes && (
              <TradingChartPopup
                stockName={stock.name}
                currentTradingValue={stock.trading_value}
                currentVolume={stock.volume}
                changes={history.changes}
                intradayDays={intradayDays}
                onClose={() => setShowTradingChart(false)}
              />
            )}
            {/* 거래 히스토리 (카드: 최근 9일) */}
            {isTradingHistoryExpanded && history?.changes && (() => {
              const allChanges = [...history.changes].reverse().slice(-11) // 과거→최신 (마지막=오늘D, D-10~D)
              if (allChanges.length === 0) return null
              return (
                <div className="mt-1 text-[10px] space-y-0.5">
                  <div className="flex items-center text-[10px] text-muted-foreground font-medium pb-0.5 border-b border-border/30">
                    <span className="w-6 shrink-0">일자</span>
                    <span className="w-14 shrink-0 text-right">등락률</span>
                    <span className="flex-1 text-right">거래대금</span>
                    <span className="flex-1 text-right">거래량</span>
                  </div>
                  {allChanges.map((c, idx) => {
                    const isToday = idx === allChanges.length - 1
                    const label = isToday ? "D" : `D-${allChanges.length - 1 - idx}`
                    const cr = isToday ? stock.change_rate : c.change_rate
                    const tv = isToday ? (stock.trading_value ?? c.trading_value) : c.trading_value
                    const vol = isToday ? (stock.volume ?? c.volume) : c.volume
                    return (
                      <div key={idx} className={cn("flex items-center text-muted-foreground px-1.5 py-0.5 rounded", isToday ? "bg-muted/60 font-medium" : "bg-muted/30")}>
                        <span className="font-medium w-6 shrink-0">{label}</span>
                        <span className={cn("w-14 shrink-0 text-right font-medium tabular-nums", cr >= 0 ? "text-red-500" : "text-blue-500")}>{cr > 0 ? "+" : ""}{cr.toFixed(1)}%</span>
                        <span className="flex-1 text-right tabular-nums">{tv != null ? <span className="text-foreground font-medium">{formatTradingValue(tv)}</span> : "-"}</span>
                        <span className="flex-1 text-right tabular-nums">{vol != null ? <span className="text-foreground font-medium">{formatVolume(vol)}</span> : "-"}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* 투자자 수급 (admin만 표시) */}
          {isAdmin && (
            <div className="pt-1 border-t border-border/30">
              <div className="flex items-center gap-1 mb-1">
                <Users className="w-3.5 h-3.5 text-sky-500/60" />
                <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground/80 tracking-wider">수급</span>
                {investorUpdatedAt && <span className="text-[10px] text-muted-foreground/70 tabular-nums">{investorUpdatedAt.slice(11, 16)}</span>}
              </div>
              {investorInfo ? (
                <>
                  <div
                    className={cn("flex items-center gap-1 sm:gap-1.5 text-xs", investorInfo.history && investorInfo.history.length > 0 && "cursor-pointer")}
                    onClick={() => investorInfo.history && investorInfo.history.length > 0 && setIsInvestorHistoryExpanded(!isInvestorHistoryExpanded)}
                  >
                    {/* 히스토리 확장 토글 */}
                    {investorInfo.history && investorInfo.history.length > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsInvestorHistoryExpanded(!isInvestorHistoryExpanded) }}
                        className="text-muted-foreground hover:text-foreground transition-all"
                      >
                        {isInvestorHistoryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {/* 수급 데이터 */}
                    <div className="flex items-center flex-1 min-w-0 gap-0.5 sm:gap-2">
                      {[
                        { key: "f", label: "외", labelFull: "외국인", color: "bg-red-500", val: investorInfo.foreign_net, est: true },
                        { key: "i", label: "기", labelFull: "기관", color: "bg-violet-500", val: investorInfo.institution_net, est: true },
                        ...(investorInfo.individual_net != null ? [{ key: "d", label: "개", labelFull: "개인", color: "bg-green-500", val: investorInfo.individual_net, est: false }] : []),
                        ...(investorInfo.program_net != null ? [{ key: "p", label: "프", labelFull: "프로그램", color: "bg-cyan-500", val: investorInfo.program_net, est: false }] : []),
                      ].map((d) => (
                        <span key={d.key} className="flex-1 flex flex-col items-center whitespace-nowrap sm:bg-muted/50 sm:rounded-md sm:px-3 sm:py-2">
                          <span className="flex items-center gap-0.5 text-[10px] sm:text-xs font-semibold text-foreground/60 leading-tight">
                            <span className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0", d.color)} />
                            <span className="sm:hidden">{d.label}</span><span className="hidden sm:inline">{d.labelFull}</span>
                          </span>
                          <span className={cn("text-[10px] sm:text-sm font-medium tabular-nums leading-tight", getNetBuyColor(d.val))}>{formatNetBuy(d.val, 0)}</span>
                        </span>
                      ))}
                    </div>
                    {/* 수급 시간 + 스파크라인 */}
                    {investorUpdatedAt && (() => {
                      const info = getInvestorScheduleInfo(investorUpdatedAt, !!investorEstimated)
                      const roundText = "round" in info ? `${info.round}차` : info.label
                      return (
                        <button onClick={(e) => { e.stopPropagation(); setShowSchedule(true) }} className="flex flex-col items-center leading-tight text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors whitespace-nowrap shrink-0">
                          <span>{roundText}</span>
                          <span>{investorUpdatedAt.slice(11, 16)}</span>
                        </button>
                      )
                    })()}
                    {(() => {
                        const investorSparkData = investorInfo.history && investorInfo.history.length > 0
                          ? [...investorInfo.history].reverse().map(h => h.foreign_net).concat(investorInfo.foreign_net)
                          : [investorInfo.foreign_net]
                        return (
                        <div className="flex items-center shrink-0 rounded-md border border-border/50 overflow-hidden">
                          <button onClick={(e) => { e.stopPropagation(); setShowInvestorChart(true) }} className="px-1.5 py-1 opacity-70 hover:opacity-100 hover:bg-muted/50 transition-all cursor-pointer">
                            <Sparkline data={investorSparkData} color="#ef4444" className="pointer-events-none" />
                          </button>
                          <div className="w-px self-stretch bg-border/50" />
                          <button onClick={(e) => { e.stopPropagation(); setShowInvestorChart(true) }} className="px-1.5 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                            <Maximize2 className="w-3 h-3" />
                          </button>
                        </div>
                        )
                      })()}
                  </div>
                  {/* 수급 스케줄/차트 팝업 */}
                  {showSchedule && investorUpdatedAt && (() => {
                    const info = getInvestorScheduleInfo(investorUpdatedAt, !!investorEstimated)
                    return <InvestorSchedulePopup currentRound={"round" in info ? info.label : info.label} updatedAt={investorUpdatedAt} onClose={() => setShowSchedule(false)} />
                  })()}
                  {showInvestorChart && investorInfo && (
                    <InvestorChartPopup
                      stockName={stock.name}
                      investorInfo={investorInfo}
                      stockCode={stock.code}
                      investorIntraday={investorIntraday}
                      investorEstimated={investorEstimated}
                      investorUpdatedAt={investorUpdatedAt}
                      onClose={() => setShowInvestorChart(false)}
                    />
                  )}
                  {/* 수급 히스토리 (D-N ~ D) */}
                  {isInvestorHistoryExpanded && investorInfo.history && investorInfo.history.length > 0 && (() => {
                    const reversed = [...investorInfo.history].reverse()
                    const allDays = [
                      ...reversed,
                      { foreign_net: investorInfo.foreign_net, institution_net: investorInfo.institution_net, individual_net: investorInfo.individual_net, program_net: investorInfo.program_net },
                    ]
                    return (
                    <div className="mt-1 text-[10px] space-y-0.5">
                      <div className="flex items-center text-[10px] text-muted-foreground font-medium pb-0.5 border-b border-border/30">
                        <span className="w-6 shrink-0">일자</span>
                        <span className="flex-1 text-right">외국인</span>
                        <span className="flex-1 text-right">기관</span>
                        <span className="flex-1 text-right">개인</span>
                        <span className="flex-1 text-right">프로그램</span>
                      </div>
                      {allDays.map((h, idx) => {
                        const label = idx === allDays.length - 1 ? "D" : `D-${allDays.length - 1 - idx}`
                        return (
                          <div key={idx} className={cn("flex items-center text-muted-foreground px-1.5 py-0.5 rounded", idx === allDays.length - 1 ? "bg-muted/60 font-medium" : "bg-muted/30")}>
                            <span className="font-medium w-6 shrink-0">{label}</span>
                            <span className={cn("flex-1 text-right tabular-nums", getNetBuyColor(h.foreign_net))}>{formatNetBuy(h.foreign_net)}</span>
                            <span className={cn("flex-1 text-right tabular-nums", getNetBuyColor(h.institution_net))}>{formatNetBuy(h.institution_net)}</span>
                            <span className={cn("flex-1 text-right tabular-nums", h.individual_net != null ? getNetBuyColor(h.individual_net) : "text-muted-foreground")}>{h.individual_net != null ? formatNetBuy(h.individual_net) : "-"}</span>
                            <span className={cn("flex-1 text-right tabular-nums", h.program_net != null ? getNetBuyColor(h.program_net) : "text-muted-foreground")}>{h.program_net != null ? formatNetBuy(h.program_net) : "-"}</span>
                          </div>
                        )
                      })}
                    </div>
                    )})()}
                </>
              ) : (
                <div className="flex items-center gap-x-2 text-xs text-muted-foreground/60">
                  <span>외국인 -</span>
                  <span>기관 -</span>
                  <span>개인 -</span>
                  <span className="ml-auto text-[10px]">수집 전</span>
                </div>
              )}
            </div>
          )}

          {/* 수급원 TOP5 (admin만 표시) */}
          {isAdmin && (
            <div className="pt-1.5 border-t border-border/30">
              <button
                onClick={() => setMemberExpanded(prev => !prev)}
                className="flex items-center gap-1 mb-1 w-full text-left"
              >
                <Building2 className="w-3.5 h-3.5 text-violet-500/60" />
                <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground/80 tracking-wider">거래원</span>
                {investorUpdatedAt && <span className="text-[10px] text-muted-foreground/70 tabular-nums">{investorUpdatedAt.slice(11, 16)}</span>}
                {!hasMemberData && <span className="text-[10px] text-muted-foreground/40 ml-auto mr-1">데이터 수집 전</span>}
                <ChevronDown className={cn("w-3 h-3 text-muted-foreground/40 transition-transform", hasMemberData && "ml-auto", memberExpanded && "rotate-180")} />
              </button>
              {memberExpanded && hasMemberData && (
              <div className="grid grid-cols-2 gap-3 cursor-pointer hover:bg-muted/30 rounded-md transition-colors -mx-1 px-1 py-0.5" onClick={() => setShowMemberChart(true)}>
              <div>
                <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground mb-1">매도 TOP5</p>
                {memberInfo.sell_top5.map((s, i) => (
                  <div key={i} className={cn(
                    "flex items-center justify-between text-[10px] sm:text-[11px] px-1 py-px rounded",
                    i % 2 === 0 && "bg-muted/50"
                  )}>
                    <span className={s.is_foreign ? "text-red-500 font-medium" : "text-foreground"}>{s.name}</span>
                    <span className="text-muted-foreground tabular-nums">{s.ratio.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground mb-1">매수 TOP5</p>
                {memberInfo.buy_top5.map((b, i) => (
                  <div key={i} className={cn(
                    "flex items-center justify-between text-[10px] sm:text-[11px] px-1 py-px rounded",
                    i % 2 === 0 && "bg-muted/50"
                  )}>
                    <span className={b.is_foreign ? "text-red-500 font-medium" : "text-foreground"}>{b.name}</span>
                    <span className="text-muted-foreground tabular-nums">{b.ratio.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
              )}
              {showMemberChart && memberInfo && (
                <MemberChartPopup
                  stockName={stock.name}
                  memberInfo={memberInfo}
                  onClose={() => setShowMemberChart(false)}
                />
              )}
            </div>
          )}

        </div>

        {/* 매물대 (admin만 표시) */}
        {isAdmin && (
          <div className="pt-1.5 border-t border-border/30 -mx-3 px-3 -mb-1 pb-1 sm:-mx-4 sm:px-4">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-amber-500/60" />
              <span className="font-semibold tracking-wider">매물대</span>
              {vpUpdatedAt && (
                <span className="text-[10px] text-muted-foreground/70 tabular-nums">{vpUpdatedAt.slice(11, 16)}</span>
              )}
              {!hasVpData && <span className="text-[10px] text-muted-foreground/40 ml-auto mr-1">데이터 수집 전</span>}
              <button
                onClick={(e) => { e.stopPropagation(); setVpExpanded(v => !v) }}
                className={cn("p-0.5 hover:text-foreground transition-colors", hasVpData && "ml-auto")}
              >
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", vpExpanded && "rotate-180")} />
              </button>
            </div>
            {vpExpanded && hasVpData && (
              <div
                className="flex gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors rounded-md"
                onClick={() => setShowVolumeProfile(true)}
              >
                {([
                  { key: "1w" as const, label: "1주" },
                  { key: "1m" as const, label: "1달" },
                  { key: "3m" as const, label: "3개월" },
                  { key: "6m" as const, label: "6개월" },
                ] as const).map(({ key, label }) => {
                  const vp = volumeProfile[key]
                  return (
                    <div key={key} className="flex-1 flex flex-col items-center rounded-md py-1 px-1 bg-muted/50">
                      <span className="text-[10px] sm:text-[10px] font-medium text-muted-foreground/70 leading-tight">
                        {label}
                      </span>
                      <span className="text-[11px] sm:text-xs font-semibold tabular-nums leading-tight text-foreground/80">
                        {vp ? formatPrice(vp.poc_price) : "-"}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {showVolumeProfile && volumeProfile && (
          <VolumeProfilePopup
            stockName={stock.name}
            stockCode={stock.code}
            stockPrice={stock.current_price}
            volumeProfile={volumeProfile}
            onClose={() => setShowVolumeProfile(false)}
          />
        )}

        {/* Golden Cross Section */}
        {isAdmin && (() => {
          const gc = criteria?.golden_cross
          if (!gc) {
            return (
              <div className="border-t border-border/30 pt-1.5 mt-1.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground/30" />
                  <span className="text-[10px] font-medium text-muted-foreground">골든크로스</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-1">데이터 수집 전</span>
                </div>
              </div>
            )
          }
          const gcMet = !!gc.met
          return (
            <div className="border-t border-border/30 pt-1.5 mt-1.5">
              <button
                onClick={() => setGcExpanded(prev => !prev)}
                className="flex items-center gap-1.5 w-full text-left"
              >
                <Sparkles className={cn("w-3.5 h-3.5", gcMet ? "text-yellow-500/60" : "text-muted-foreground/30")} />
                <span className="text-[10px] font-medium text-muted-foreground">골든크로스</span>
                {dataTimestamp && (
                  <span className="text-[10px] text-muted-foreground/70 tabular-nums">{dataTimestamp.slice(11, 16)}</span>
                )}
                <span className={cn("text-[10px] font-semibold tabular-nums", gcMet ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground/40")}>
                  {gc.signal_count}/7
                </span>
                <ChevronDown className={cn("w-3 h-3 text-muted-foreground/40 ml-auto transition-transform", gcExpanded && "rotate-180")} />
              </button>
              {gcExpanded && (
                <div className="mt-1 space-y-1">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(GOLDEN_CROSS_LABELS).map(([k, { label }]) => {
                      const active = gc.signals?.[k]
                      return (
                        <button
                          key={k}
                          onClick={() => setSelectedGcKey(prev => prev === k ? null : k)}
                          className={cn(
                            "text-[10px] rounded-md py-1 px-1.5 cursor-pointer transition-colors",
                            active ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 font-medium" : "bg-muted/50 text-muted-foreground/50"
                          )}
                        >
                          {active ? "✓" : "✗"} {label}
                        </button>
                      )
                    })}
                  </div>
                  {selectedGcKey && GOLDEN_CROSS_LABELS[selectedGcKey] && (
                    <div className="text-[10px] text-muted-foreground bg-muted/30 rounded-md p-2 space-y-1">
                      <p className="font-medium text-foreground/70">{GOLDEN_CROSS_LABELS[selectedGcKey].description}</p>
                      <p>{GOLDEN_CROSS_LABELS[selectedGcKey].detail}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* News Section (3차 정보 — 토글) */}
        <div className="mt-2 pt-2 border-t border-border/50">
          <button
            onClick={() => hasNews && setIsNewsExpanded(!isNewsExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-1.5">
              <Newspaper className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">
                {hasNews ? `관련 뉴스 (${news!.news.length})` : "관련 뉴스"}
              </span>
              {!hasNews && <span className="text-[10px] text-muted-foreground/50">뉴스 없음</span>}
            </div>
            {hasNews && (isNewsExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ))}
          </button>

          {hasNews && (
            <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", isNewsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <ul className={cn("mt-1.5 space-y-1 overflow-hidden", !isNewsExpanded && "mt-0")}>
              {news!.news.slice(0, 3).map((item, idx) => (
                <li key={idx}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] sm:text-xs text-muted-foreground hover:text-primary transition-colors line-clamp-2 sm:line-clamp-1 block"
                    title={item.title}
                  >
                    • {item.title.replace(/<[^>]*>/g, '')}
                  </a>
                </li>
              ))}
            </ul>
            </div>
          )}
        </div>
      </CardContent>
      <MetricsInfoModal popup={metricsPopup} onClose={() => setMetricsPopup(null)} />
    </Card>
  )
})
