import { useState, Fragment } from "react"
import { TrendingUp, TrendingDown, ExternalLink, Newspaper, ChevronDown, ChevronUp, Crown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatPrice, formatVolume, formatChangeRate, formatTradingValue, getChangeBgColor, formatNetBuy, getNetBuyColor } from "@/lib/utils"
import { CRITERIA_CONFIG } from "@/lib/criteria"
import { getInvestorScheduleInfo } from "@/lib/investor-schedule"
import { CriteriaPopup } from "@/components/CriteriaPopup"
import { PriceHistoryPopup } from "@/components/PriceHistoryPopup"
import { TradingChartPopup } from "@/components/TradingChartPopup"
import { InvestorChartPopup } from "@/components/InvestorChartPopup"
import { Sparkline } from "@/components/Sparkline"
import type { Stock, StockHistory, StockNews, InvestorInfo, MemberInfo, StockCriteria } from "@/types/stock"

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
  isAdmin?: boolean
}

export function StockCard({ stock, history, news, type, investorInfo, investorEstimated, investorUpdatedAt, memberInfo, criteria, isAdmin }: StockCardProps) {
  const [isNewsExpanded, setIsNewsExpanded] = useState(false)
  const [showCriteriaPopup, setShowCriteriaPopup] = useState(false)
  const [showPriceHistory, setShowPriceHistory] = useState(false)
  const [showTradingChart, setShowTradingChart] = useState(false)
  const [showInvestorChart, setShowInvestorChart] = useState(false)
  const [isTradingHistoryExpanded, setIsTradingHistoryExpanded] = useState(false)
  const [isInvestorHistoryExpanded, setIsInvestorHistoryExpanded] = useState(false)
  const effectiveType = type === "neutral" ? (stock.change_rate >= 0 ? "rising" : "falling") : type
  const isRising = effectiveType === "rising"
  const TrendIcon = isRising ? TrendingUp : TrendingDown
  const naverUrl = `https://m.stock.naver.com/domestic/stock/${stock.code}/total`
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
      "group hover:shadow-lg transition-all duration-200 hover:border-primary/30 bg-card relative",
      allMet && isAdmin
        ? "ring-2 ring-yellow-400/70 shadow-[0_0_12px_rgba(234,179,8,0.3)] animate-[shimmer_3s_ease-in-out_infinite]"
        : ""
    )}>
      {/* 경고 알림 뱃지 */}
      {isAdmin && (shortWarning || overheatWarning || reverseWarning) && (
        <div className="absolute -top-1.5 -right-1.5 z-10 flex gap-0.5">
          {shortWarning && <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white animate-pulse" title="공매도 경고" />}
          {overheatWarning && <span className="w-3 h-3 rounded-full bg-amber-500 border-2 border-white animate-pulse" title="과열 경고" />}
          {reverseWarning && <span className="w-3 h-3 rounded-full bg-indigo-500 border-2 border-white animate-pulse" title="역배열 경고" />}
        </div>
      )}
      <CardContent className="p-3 sm:p-4">
        {/* Header: Rank + Name + Price */}
        <div className="flex items-start justify-between gap-2">
          {/* Left: Rank + Name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={cn(
              "flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-bold shrink-0",
              isRising ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600"
            )}>
              {stock.rank}
            </div>
            <div className="min-w-0 flex-1">
              <a
                href={naverUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-sm sm:text-base text-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <span className="truncate">{stock.name}</span>
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
                            "hidden sm:inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-medium cursor-pointer",
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
            <p className="font-bold text-sm sm:text-base tabular-nums">
              {formatPrice(stock.current_price)}
              <span className="text-muted-foreground text-[10px] sm:text-xs ml-0.5">원</span>
            </p>
            <div className="flex items-center justify-end gap-1">
              {/* D-2, D-1 등락률 (클릭하면 6일 팝업) */}
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
                        "text-[8px] px-0.5 rounded font-medium whitespace-nowrap tabular-nums cursor-pointer hover:opacity-70 transition-opacity",
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
            {/* 6일 가격 변동 팝업 */}
            {showPriceHistory && history && history.changes && (
              <PriceHistoryPopup
                stockName={stock.name}
                currentPrice={stock.current_price}
                currentChangeRate={stock.change_rate}
                changes={history.changes}
                onClose={() => setShowPriceHistory(false)}
              />
            )}
          </div>
        </div>

        {/* Volume + History */}
        <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
          {/* 거래 정보 */}
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {stock.trading_value != null && (
                <span className="text-muted-foreground">
                  거래대금 <span className="font-medium text-foreground">{formatTradingValue(stock.trading_value)}</span>
                </span>
              )}
              <span className="text-muted-foreground">
                거래량 <span className="font-medium text-foreground">{formatVolume(stock.volume)}</span>
              </span>
              {/* 6일 거래대금 추이 스파크라인 + 히스토리 토글 */}
              {history?.changes && history.changes.length > 1 && (
                <div className="flex items-center ml-auto shrink-0 rounded-md border border-border/50 overflow-hidden">
                  <button onClick={() => setShowTradingChart(true)} className="px-1.5 py-1 opacity-70 hover:opacity-100 hover:bg-muted/50 transition-all cursor-pointer">
                    <Sparkline
                      data={[...history.changes].reverse().map(c => c.trading_value ?? 0)}
                      color="#f59e0b"
                      className="pointer-events-none"
                    />
                  </button>
                  <div className="w-px self-stretch bg-border/50" />
                  <button
                    onClick={() => setIsTradingHistoryExpanded(!isTradingHistoryExpanded)}
                    className="px-1.5 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                  >
                    {isTradingHistoryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
              {/* 거래 차트 팝업 */}
              {showTradingChart && history?.changes && (
                <TradingChartPopup
                  stockName={stock.name}
                  currentTradingValue={stock.trading_value}
                  currentVolume={stock.volume}
                  changes={history.changes}
                  onClose={() => setShowTradingChart(false)}
                />
              )}
            </div>
            {/* 거래 히스토리 (최대 6일) */}
            {isTradingHistoryExpanded && history?.changes && (() => {
              const pastDays = history.changes.slice(1) // D-1 ~ D-5 (내림차순)
              if (pastDays.length === 0) return null
              return (
                <div className="mt-1 text-[10px] space-y-0.5">
                  {pastDays.map((c, idx) => {
                    const dayNum = idx + 1
                    const label = `D-${dayNum}`
                    return (
                      <div key={idx} className="flex items-center gap-x-2 text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                        <span className="font-medium w-6">{label}</span>
                        <span className={cn("font-medium", c.change_rate >= 0 ? "text-red-500" : "text-blue-500")}>{c.change_rate > 0 ? "+" : ""}{c.change_rate.toFixed(1)}%</span>
                        {c.trading_value != null && <span>거래대금 <span className="text-foreground font-medium">{formatTradingValue(c.trading_value)}</span></span>}
                        {c.volume != null && <span>거래량 <span className="text-foreground font-medium">{formatVolume(c.volume)}</span></span>}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* 투자자 수급 (admin만 표시) */}
          {isAdmin && (
            <div className="pt-1.5 border-t border-border/30">
              {investorInfo ? (
                <>
                  <div className="flex items-center gap-x-2 text-xs">
                    <span className="text-muted-foreground whitespace-nowrap">
                      <span className="sm:hidden">외</span><span className="hidden sm:inline">외국인</span>{investorEstimated && <span className="text-[8px] text-amber-500 ml-0.5">추정</span>} <span className={cn("font-medium", getNetBuyColor(investorInfo.foreign_net))}>{formatNetBuy(investorInfo.foreign_net)}</span>
                    </span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      <span className="sm:hidden">기</span><span className="hidden sm:inline">기관</span>{investorEstimated && <span className="text-[8px] text-amber-500 ml-0.5">추정</span>} <span className={cn("font-medium", getNetBuyColor(investorInfo.institution_net))}>{formatNetBuy(investorInfo.institution_net)}</span>
                    </span>
                    {investorInfo.individual_net != null && (
                      <span className="text-muted-foreground whitespace-nowrap">
                        <span className="sm:hidden">개</span><span className="hidden sm:inline">개인</span> <span className={cn("font-medium", getNetBuyColor(investorInfo.individual_net))}>{formatNetBuy(investorInfo.individual_net)}</span>
                      </span>
                    )}
                    {/* 외국인 순매수 스파크라인 + 히스토리 토글 */}
                    {investorInfo.history && investorInfo.history.length > 0 && (
                      <div className="flex items-center ml-auto shrink-0 rounded-md border border-border/50 overflow-hidden">
                        <button onClick={() => setShowInvestorChart(true)} className="px-1.5 py-1 opacity-70 hover:opacity-100 hover:bg-muted/50 transition-all cursor-pointer">
                          <Sparkline
                            data={[...investorInfo.history].reverse().map(h => h.foreign_net).concat(investorInfo.foreign_net)}
                            color="#ef4444"
                            className="pointer-events-none"
                          />
                        </button>
                        <div className="w-px self-stretch bg-border/50" />
                        <button
                          onClick={() => setIsInvestorHistoryExpanded(!isInvestorHistoryExpanded)}
                          className="px-1.5 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                        >
                          {isInvestorHistoryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                    {investorUpdatedAt && (() => {
                      const info = getInvestorScheduleInfo(investorUpdatedAt, !!investorEstimated)
                      const roundText = "round" in info ? `${info.round}차` : info.label
                      return <span className={cn("text-[8px] text-muted-foreground/60", !investorInfo.history?.length && "ml-auto")}>{roundText} {investorUpdatedAt.slice(11, 16)}</span>
                    })()}
                    {/* 수급 차트 팝업 */}
                    {showInvestorChart && investorInfo && (
                      <InvestorChartPopup
                        stockName={stock.name}
                        investorInfo={investorInfo}
                        onClose={() => setShowInvestorChart(false)}
                      />
                    )}
                  </div>
                  {/* 수급 히스토리 (최대 6일) */}
                  {isInvestorHistoryExpanded && investorInfo.history && investorInfo.history.length > 0 && (
                    <div className="mt-1 text-[10px] space-y-0.5">
                      {investorInfo.history.map((h, idx) => {
                        const label = `D-${idx + 1}`
                        return (
                          <div key={idx} className="flex items-center gap-x-2 text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                            <span className="font-medium w-6">{label}</span>
                            <span>외국인 <span className={cn("font-medium", getNetBuyColor(h.foreign_net))}>{formatNetBuy(h.foreign_net)}</span></span>
                            <span>기관 <span className={cn("font-medium", getNetBuyColor(h.institution_net))}>{formatNetBuy(h.institution_net)}</span></span>
                            {h.individual_net != null && (
                              <span>개인 <span className={cn("font-medium", getNetBuyColor(h.individual_net))}>{formatNetBuy(h.individual_net)}</span></span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-x-2 text-xs text-muted-foreground/60">
                  <span>외국인 -</span>
                  <span>기관 -</span>
                  <span>개인 -</span>
                  <span className="ml-auto text-[8px]">수집 전</span>
                </div>
              )}
            </div>
          )}

          {/* 수급원 TOP5 (admin만 표시) */}
          {isAdmin && memberInfo && (memberInfo.buy_top5.length > 0 || memberInfo.sell_top5.length > 0) && (
            <div className="grid grid-cols-2 gap-3 pt-1.5 border-t border-border/30">
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
            </div>
          )}

        </div>

        {/* News Section */}
        {hasNews && (
          <div className="mt-2 pt-2 border-t border-border/50">
            {/* Mobile: Expand/Collapse Button */}
            <button
              onClick={() => setIsNewsExpanded(!isNewsExpanded)}
              className="sm:hidden flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-1.5">
                <Newspaper className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">
                  관련 뉴스 ({news.news.length})
                </span>
              </div>
              {isNewsExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {/* Mobile: Collapsible News List */}
            {isNewsExpanded && (
              <ul className="sm:hidden mt-1.5 space-y-1">
                {news.news.slice(0, 3).map((item, idx) => (
                  <li key={idx}>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors line-clamp-2 block"
                      title={item.title}
                    >
                      • {item.title.replace(/<[^>]*>/g, '')}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {/* Desktop: Always visible */}
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Newspaper className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">관련 뉴스</span>
              </div>
              <ul className="space-y-1">
                {news.news.slice(0, 3).map((item, idx) => (
                  <li key={idx}>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] sm:text-xs text-muted-foreground hover:text-primary transition-colors line-clamp-1 block"
                      title={item.title}
                    >
                      • {item.title.replace(/<[^>]*>/g, '')}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
