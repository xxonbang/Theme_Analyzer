import { useState, useMemo, useEffect } from "react"
import { TrendingUp, TrendingDown, BarChart3, ExternalLink, Crown } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StockCard } from "@/components/StockCard"
import { cn, formatPrice, formatVolume, formatChangeRate, formatTradingValue, formatNetBuy, getNetBuyColor } from "@/lib/utils"
import { CRITERIA_CONFIG } from "@/lib/criteria"
import { getInvestorScheduleInfo } from "@/lib/investor-schedule"
import { CriteriaPopup } from "@/components/CriteriaPopup"
import { TradingChartPopup } from "@/components/TradingChartPopup"
import { InvestorChartPopup } from "@/components/InvestorChartPopup"
import { PriceHistoryPopup } from "@/components/PriceHistoryPopup"
import { Sparkline } from "@/components/Sparkline"
import { VolumeProfilePopup } from "@/components/VolumeProfilePopup"
import type { Stock, StockHistory, StockNews, InvestorInfo, MemberInfo, StockCriteria, InvestorIntraday, StockVolumeProfile, IntradayDay, FundamentalInfo } from "@/types/stock"

interface StockListProps {
  title: string
  kospiStocks: Stock[]
  kosdaqStocks: Stock[]
  history: Record<string, StockHistory>
  news: Record<string, StockNews>
  type: "rising" | "falling" | "neutral"
  compactMode?: boolean
  showTradingValue?: boolean
  investorData?: Record<string, InvestorInfo>
  investorEstimated?: boolean
  investorUpdatedAt?: string
  memberData?: Record<string, MemberInfo>
  criteriaData?: Record<string, StockCriteria>
  investorIntraday?: InvestorIntraday
  isAdmin?: boolean
  dataTimestamp?: string
  volumeProfiles?: Record<string, StockVolumeProfile>
  vpUpdatedAt?: string
  intradayHistory?: Record<string, IntradayDay[]>
  fundamentalData?: Record<string, FundamentalInfo>
  initialLimit?: number
  sectionId?: string
  expandForCode?: string | null
}

// 마켓 섹션 (KOSPI/KOSDAQ 영역)
function StockMarketSection({
  label, dotColor, stocks, history, news, type,
  investorData, investorEstimated, investorUpdatedAt, memberData, criteriaData, investorIntraday, isAdmin, dataTimestamp, volumeProfiles, vpUpdatedAt, intradayHistory, fundamentalData, initialLimit, expandForCode,
}: {
  label: string; dotColor: string; stocks: Stock[];
  history: Record<string, StockHistory>; news: Record<string, StockNews>;
  type: "rising" | "falling" | "neutral";
  investorData?: Record<string, InvestorInfo>; investorEstimated?: boolean; investorUpdatedAt?: string;
  memberData?: Record<string, MemberInfo>; criteriaData?: Record<string, StockCriteria>; investorIntraday?: InvestorIntraday; isAdmin?: boolean; dataTimestamp?: string; volumeProfiles?: Record<string, StockVolumeProfile>; vpUpdatedAt?: string; intradayHistory?: Record<string, IntradayDay[]>; fundamentalData?: Record<string, FundamentalInfo>; initialLimit?: number; expandForCode?: string | null;
}) {
  const [expanded, setExpanded] = useState(false)

  // 스크롤 대상 종목이 initialLimit 밖에 있으면 자동 확장
  useEffect(() => {
    if (!expandForCode || !initialLimit || expanded) return
    const idx = stocks.findIndex(s => s.code === expandForCode)
    if (idx >= initialLimit) setExpanded(true)
  }, [expandForCode, initialLimit, stocks, expanded])
  const hasMore = initialLimit != null && stocks.length > initialLimit
  const visibleStocks = hasMore && !expanded ? stocks.slice(0, initialLimit) : stocks

  const renderCard = (stock: Stock) => (
    <StockCard
      key={stock.code}
      stock={stock}
      history={history[stock.code]}
      news={news[stock.code]}
      type={type}
      investorInfo={investorData?.[stock.code]}
      investorEstimated={investorEstimated}
      investorUpdatedAt={investorUpdatedAt}
      memberInfo={memberData?.[stock.code]}
      criteria={criteriaData?.[stock.code]}
      investorIntraday={investorIntraday}
      isAdmin={isAdmin}
      dataTimestamp={dataTimestamp}
      volumeProfile={volumeProfiles?.[stock.code]}
      vpUpdatedAt={vpUpdatedAt}
      intradayDays={intradayHistory?.[stock.code]}
      fundamental={fundamentalData?.[stock.code]}
    />
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div className={cn("w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full", dotColor)} />
        <h3 className="font-semibold text-sm sm:text-base md:text-lg">{label}</h3>
        <span className="text-xs sm:text-sm text-muted-foreground">({stocks.length})</span>
      </div>
      {stocks.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {visibleStocks.map(renderCard)}
          </div>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full mt-2 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg border border-dashed border-border/50 transition-colors"
            >
              {expanded ? "접기" : `더보기 (+${stocks.length - initialLimit})`}
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 sm:py-8 text-center bg-muted/20 rounded-lg border border-dashed border-border/50">
          <BarChart3 className="w-6 h-6 text-muted-foreground/40" />
          <p className="text-muted-foreground text-xs sm:text-sm">해당 종목 없음</p>
        </div>
      )}
    </div>
  )
}

// 컴팩트 모드 컬럼 헤더 (flex: sticky left + scrollable right)
function CompactHeader({ showTradingValue, hasMemberData, investorEstimated, investorUpdatedAt, isAdmin }: { showTradingValue?: boolean; hasMemberData?: boolean; investorEstimated?: boolean; investorUpdatedAt?: string; isAdmin?: boolean }) {
  const estimatedLabel = investorEstimated ? <span className="text-[8px] text-amber-500 ml-0.5">추정</span> : null
  const scheduleInfo = investorUpdatedAt ? getInvestorScheduleInfo(investorUpdatedAt, !!investorEstimated) : null
  const roundLabel = scheduleInfo ? ("round" in scheduleInfo ? scheduleInfo.label : scheduleInfo.label) : null
  const timeLabel = investorUpdatedAt ? <span className="text-[9px] text-muted-foreground/50 ml-0.5">{roundLabel && <span className="text-amber-500">{roundLabel}</span>} {investorUpdatedAt.slice(11, 16)}</span> : null
  return (
    <div className="flex items-center py-1.5 text-[9px] sm:text-[10px] text-muted-foreground font-medium border-b border-border/50">
      <div className="sticky left-0 z-20 bg-card self-stretch flex items-center gap-2 shrink-0 w-28 sm:w-40 pl-2 pr-1">
        <span className="w-5 text-center shrink-0">#</span>
        <span>종목명</span>
      </div>
      <div className="flex items-center shrink-0 ml-auto">
        <span className="text-right w-16 sm:w-20">현재가</span>
        {showTradingValue && <span className="text-right w-14 sm:w-16">거래대금</span>}
        <span className="text-right w-12 sm:w-14">거래량</span>
        <span className="text-center w-14 sm:w-16">거래추이</span>
        {isAdmin && <span className="text-center w-14 sm:w-16">수급추이</span>}
        {isAdmin && <span className="text-right w-14 sm:w-16">외국인{estimatedLabel}{timeLabel}</span>}
        {isAdmin && <span className="text-right w-14 sm:w-16">기관{estimatedLabel}</span>}
        {isAdmin && <span className="text-right w-14 sm:w-16">개인{investorEstimated && <span className="text-[8px] text-amber-500 ml-0.5">장중</span>}</span>}
        {isAdmin && <span className="text-right w-14 sm:w-16">프로그램</span>}
        {isAdmin && hasMemberData && <span className="text-right w-16 sm:w-20">매수1위</span>}
        {isAdmin && hasMemberData && <span className="text-right w-16 sm:w-20">매도1위</span>}
        <span className="text-right w-16 ml-2">등락률</span>
      </div>
    </div>
  )
}

// 컴팩트 모드용 간단한 종목 행 (flex: sticky left + scrollable right)
function CompactStockRow({ stock, history, type, showTradingValue, investorInfo, investorEstimated, investorUpdatedAt, investorIntraday, memberInfo, hasMemberData, criteria, isAdmin, volumeProfile, intradayDays }: { stock: Stock; history?: StockHistory; type: "rising" | "falling" | "neutral"; showTradingValue?: boolean; investorInfo?: InvestorInfo; investorEstimated?: boolean; investorUpdatedAt?: string; investorIntraday?: InvestorIntraday; memberInfo?: MemberInfo; hasMemberData?: boolean; criteria?: StockCriteria; isAdmin?: boolean; volumeProfile?: StockVolumeProfile; intradayDays?: IntradayDay[] }) {
  const effectiveRising = type === "neutral" ? stock.change_rate >= 0 : type === "rising"
  const naverUrl = `https://m.stock.naver.com/domestic/stock/${stock.code}/total`
  const allMet = isAdmin && criteria?.all_met
  const shortWarning = isAdmin && criteria?.short_selling?.met
  const overheatWarning = isAdmin && criteria?.overheating?.met
  const reverseWarning = isAdmin && criteria?.reverse_alignment?.met
  const showDots = isAdmin && criteria
  const [criteriaExpanded, setCriteriaExpanded] = useState(false)
  const [showTradingChart, setShowTradingChart] = useState(false)
  const [showInvestorChart, setShowInvestorChart] = useState(false)
  const [showPriceHistory, setShowPriceHistory] = useState(false)
  const [showVolumeProfile, setShowVolumeProfile] = useState(false)
  const metCriteria = showDots ? CRITERIA_CONFIG.filter(({ key }) => {
    const c = criteria[key as keyof StockCriteria]
    return typeof c !== "boolean" && c?.met && !c?.warning
  }) : []
  return (
    <div id={`stock-${stock.code}`} className="relative">
      <div className="flex items-center py-2 hover:bg-muted/50 transition-colors group">
      {/* Sticky left: Rank + Name */}
      <div className={cn(
        "sticky left-0 z-20 self-stretch flex items-center gap-2 shrink-0 w-28 sm:w-40 pr-1 transition-colors",
        allMet
          ? "border-l-[3px] border-l-yellow-400 bg-amber-50 dark:bg-amber-950 pl-[5px] group-hover:bg-amber-100 dark:group-hover:bg-amber-900"
          : "bg-card pl-2 group-hover:bg-muted"
      )}>
        <span className={cn(
          "w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full shrink-0 relative",
          type === "neutral"
            ? "bg-amber-500/10 text-amber-600"
            : effectiveRising ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600"
        )}>
          {stock.rank}
          {/* 경고 알림 뱃지 */}
          {(shortWarning || overheatWarning || reverseWarning) && (
            <span className="absolute -top-1 -right-1 flex gap-px">
              {shortWarning && <span className="w-2 h-2 rounded-full border border-card animate-pulse bg-red-500" title="공매도 경고" />}
              {overheatWarning && <span className="w-2 h-2 rounded-full border border-card animate-pulse bg-amber-500" title="과열 경고" />}
              {reverseWarning && <span className="w-2 h-2 rounded-full border border-card animate-pulse bg-indigo-500" title="역배열 경고" />}
            </span>
          )}
        </span>
        <div className="min-w-0 relative">
          <a
            href={naverUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1"
          >
            <span className="font-medium text-xs truncate">{stock.name}</span>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0 hidden sm:block" />
          </a>
          {metCriteria.length > 0 && (
            <button
              onClick={() => setCriteriaExpanded(!criteriaExpanded)}
              className="flex items-center gap-px mt-0.5 hover:opacity-70 transition-opacity"
            >
              {metCriteria.map(({ key, dot }) => {
                const c = criteria![key as keyof StockCriteria]
                const is52w = key === "high_breakout" && typeof c !== "boolean" && c?.is_52w_high
                return (
                  <span key={key} className="flex items-center gap-px">
                    <span className={cn("w-1.5 h-1.5 rounded-full", dot, is52w && "ring-1 ring-amber-400")} />
                    {is52w && <Crown className="w-2.5 h-2.5 text-amber-500" />}
                  </span>
                )
              })}
            </button>
          )}
          {/* Criteria popup */}
          {criteriaExpanded && criteria && (
            <CriteriaPopup stockName={stock.name} criteria={criteria} onClose={() => setCriteriaExpanded(false)} />
          )}
        </div>
      </div>

      {/* Scrollable right: Data columns */}
      <div className="flex items-center shrink-0">
        <a href={naverUrl} target="_blank" rel="noopener noreferrer" className="flex items-center">
          <span className="text-xs font-medium tabular-nums text-right w-16 sm:w-20">
            {formatPrice(stock.current_price)}<span className="text-[9px] text-muted-foreground">원</span>
          </span>
          {showTradingValue && (
            <span className="text-[10px] text-muted-foreground tabular-nums text-right w-14 sm:w-16">
              {stock.trading_value ? formatTradingValue(stock.trading_value) : "-"}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground tabular-nums text-right w-12 sm:w-14">
            {formatVolume(stock.volume)}
          </span>
        </a>
        {/* 거래대금 스파크라인 → 거래 차트 팝업 */}
        <button
          onClick={() => history?.changes && history.changes.length > 1 && setShowTradingChart(true)}
          className="flex items-center justify-center w-14 sm:w-16 cursor-pointer hover:opacity-70 transition-opacity"
        >
          {history?.changes && history.changes.length > 1 && (
            <Sparkline
              data={[...history.changes].slice(0, 11).reverse().map(c => c.trading_value ?? 0)}
              color="#f59e0b"
              width={48}
              height={14}
              className="opacity-70 pointer-events-none"
            />
          )}
        </button>
        {/* 외국인 수급 스파크라인 → 수급 차트 팝업 */}
        {isAdmin && (
          <button
            onClick={() => investorInfo && setShowInvestorChart(true)}
            className="flex items-center justify-center w-14 sm:w-16 cursor-pointer hover:opacity-70 transition-opacity"
          >
            {investorInfo && (
              <Sparkline
                data={investorInfo.history && investorInfo.history.length > 0
                  ? [...investorInfo.history].reverse().map(h => h.foreign_net).concat(investorInfo.foreign_net)
                  : [investorInfo.foreign_net]}
                color="#ef4444"
                width={48}
                height={14}
                className="opacity-70 pointer-events-none"
              />
            )}
          </button>
        )}
        <a href={naverUrl} target="_blank" rel="noopener noreferrer" className="flex items-center">
          {isAdmin && (
            <span className={cn("text-[10px] tabular-nums text-right w-14 sm:w-16", investorInfo ? getNetBuyColor(investorInfo.foreign_net) : "text-muted-foreground")}>
              {investorInfo ? formatNetBuy(investorInfo.foreign_net) : "-"}
            </span>
          )}
          {isAdmin && (
            <span className={cn("text-[10px] tabular-nums text-right w-14 sm:w-16", investorInfo ? getNetBuyColor(investorInfo.institution_net) : "text-muted-foreground")}>
              {investorInfo ? formatNetBuy(investorInfo.institution_net) : "-"}
            </span>
          )}
          {isAdmin && (
            <span className={cn("text-[10px] tabular-nums text-right w-14 sm:w-16", investorInfo?.individual_net != null ? getNetBuyColor(investorInfo.individual_net) : "text-muted-foreground")}>
              {investorInfo?.individual_net != null ? formatNetBuy(investorInfo.individual_net) : "-"}
            </span>
          )}
          {isAdmin && (
            <span className={cn("text-[10px] tabular-nums text-right w-14 sm:w-16", investorInfo?.program_net != null ? getNetBuyColor(investorInfo.program_net) : "text-muted-foreground")}>
              {investorInfo?.program_net != null ? formatNetBuy(investorInfo.program_net) : "-"}
            </span>
          )}
          {isAdmin && hasMemberData && (
            <span className={cn("text-[10px] tabular-nums text-right w-16 sm:w-20 truncate", memberInfo?.buy_top5?.[0]?.is_foreign ? "text-red-500" : "text-muted-foreground")}>
              {memberInfo?.buy_top5?.[0]?.name || "-"}
            </span>
          )}
          {isAdmin && hasMemberData && (
            <span className={cn("text-[10px] tabular-nums text-right w-16 sm:w-20 truncate", memberInfo?.sell_top5?.[0]?.is_foreign ? "text-red-500" : "text-muted-foreground")}>
              {memberInfo?.sell_top5?.[0]?.name || "-"}
            </span>
          )}
        </a>
        {/* 매물대 버튼 (admin만) — 정렬 유지를 위해 항상 렌더 */}
        {isAdmin && (
          volumeProfile ? (
            <button
              onClick={() => setShowVolumeProfile(true)}
              className="text-[9px] text-muted-foreground hover:text-amber-600 transition-colors w-6 text-center"
              title="매물대"
            >
              VP
            </button>
          ) : (
            <span className="w-6" />
          )
        )}
        {/* 등락률 → 가격 변동 팝업 */}
        <button
          onClick={() => history?.changes && setShowPriceHistory(true)}
          className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded text-right w-16 ml-2 cursor-pointer hover:opacity-70 transition-opacity",
            effectiveRising ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600"
          )}
        >
          {formatChangeRate(stock.change_rate)}
        </button>
      </div>
      </div>

      {/* 팝업들 */}
      {showTradingChart && history?.changes && (
        <TradingChartPopup
          stockName={stock.name}
          currentTradingValue={stock.trading_value}
          currentVolume={stock.volume}
          changes={history.changes}
          onClose={() => setShowTradingChart(false)}
        />
      )}
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
      {showPriceHistory && history?.changes && (
        <PriceHistoryPopup
          stockName={stock.name}
          currentPrice={stock.current_price}
          currentChangeRate={stock.change_rate}
          changes={history.changes}
          intradayDays={intradayDays}
          onClose={() => setShowPriceHistory(false)}
        />
      )}
      {showVolumeProfile && volumeProfile && (
        <VolumeProfilePopup
          stockName={stock.name}
          stockPrice={stock.current_price}
          volumeProfile={volumeProfile}
          onClose={() => setShowVolumeProfile(false)}
        />
      )}
    </div>
  )
}

// 컴팩트 모드용 마켓 섹션
function CompactMarketSection({
  market,
  stocks,
  history,
  type,
  bgColor,
  showHeader = false,
  showTradingValue,
  investorData,
  investorEstimated,
  investorUpdatedAt,
  memberData,
  criteriaData,
  investorIntraday,
  isAdmin,
  volumeProfiles,
  intradayHistory,
  initialLimit, expandForCode,
}: {
  market: string
  stocks: Stock[]
  history?: Record<string, StockHistory>
  type: "rising" | "falling" | "neutral"
  bgColor: string
  showHeader?: boolean
  showTradingValue?: boolean
  investorData?: Record<string, InvestorInfo>
  investorEstimated?: boolean
  investorUpdatedAt?: string
  memberData?: Record<string, MemberInfo>
  criteriaData?: Record<string, StockCriteria>
  investorIntraday?: InvestorIntraday
  isAdmin?: boolean
  volumeProfiles?: Record<string, StockVolumeProfile>
  intradayHistory?: Record<string, IntradayDay[]>
  initialLimit?: number
  expandForCode?: string | null
}) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expandForCode || !initialLimit || expanded) return
    const idx = stocks.findIndex(s => s.code === expandForCode)
    if (idx >= initialLimit) setExpanded(true)
  }, [expandForCode, initialLimit, stocks, expanded])
  const hasMemberData = !!memberData && Object.keys(memberData).length > 0
  const hasMore = initialLimit != null && stocks.length > initialLimit
  const visibleStocks = hasMore && !expanded ? stocks.slice(0, initialLimit) : stocks

  if (stocks.length === 0) {
    return (
      <div className="py-2">
        <div className="flex items-center gap-1.5 mb-1 px-2">
          <div className={cn("w-2 h-2 rounded-full", bgColor)} />
          <span className="font-semibold text-xs">{market}</span>
          <span className="text-[10px] text-muted-foreground">(0)</span>
        </div>
        <p className="text-muted-foreground text-[10px] text-center py-3 bg-muted/10 rounded border border-dashed border-border/30">해당 종목 없음</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1 px-2">
        <div className={cn("w-2 h-2 rounded-full", bgColor)} />
        <span className="font-semibold text-xs">{market}</span>
        <span className="text-[10px] text-muted-foreground">({stocks.length})</span>
      </div>
      <div className="relative">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="min-w-fit">
            {showHeader && <CompactHeader showTradingValue={showTradingValue} hasMemberData={hasMemberData} investorEstimated={investorEstimated} investorUpdatedAt={investorUpdatedAt} isAdmin={isAdmin} />}
            <div className="divide-y divide-border/30">
              {visibleStocks.map((stock) => (
                <CompactStockRow key={stock.code} stock={stock} history={history?.[stock.code]} type={type} showTradingValue={showTradingValue} investorInfo={investorData?.[stock.code]} investorEstimated={investorEstimated} investorUpdatedAt={investorUpdatedAt} investorIntraday={investorIntraday} memberInfo={memberData?.[stock.code]} hasMemberData={hasMemberData} criteria={criteriaData?.[stock.code]} isAdmin={isAdmin} volumeProfile={volumeProfiles?.[stock.code]} intradayDays={intradayHistory?.[stock.code]} />
              ))}
            </div>
          </div>
        </div>
        {/* 수평 스크롤 힌트 (우측 fade) */}
        <div className="absolute top-0 right-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-card to-transparent sm:hidden" />
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-1 py-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded border border-dashed border-border/30 transition-colors"
        >
          {expanded ? "접기" : `더보기 (+${stocks.length - initialLimit})`}
        </button>
      )}
    </div>
  )
}

type SortOption = "default" | "foreign_net" | "institution_net" | "change_rate"

function sortStocks(stocks: Stock[], sortBy: SortOption, investorData?: Record<string, InvestorInfo>): Stock[] {
  if (sortBy === "default") return stocks
  return [...stocks].sort((a, b) => {
    if (sortBy === "change_rate") return (b.change_rate ?? 0) - (a.change_rate ?? 0)
    if (sortBy === "foreign_net") return (investorData?.[b.code]?.foreign_net ?? 0) - (investorData?.[a.code]?.foreign_net ?? 0)
    if (sortBy === "institution_net") return (investorData?.[b.code]?.institution_net ?? 0) - (investorData?.[a.code]?.institution_net ?? 0)
    return 0
  })
}

export function StockList({ title, kospiStocks, kosdaqStocks, history, news, type, compactMode, showTradingValue, investorData, investorEstimated, investorUpdatedAt, memberData, criteriaData, investorIntraday, isAdmin, dataTimestamp, volumeProfiles, vpUpdatedAt, intradayHistory, fundamentalData, initialLimit, sectionId, expandForCode }: StockListProps) {
  const [sortBy, setSortBy] = useState<SortOption>("default")
  const sortedKospi = useMemo(() => sortStocks(kospiStocks, sortBy, investorData), [kospiStocks, sortBy, investorData])
  const sortedKosdaq = useMemo(() => sortStocks(kosdaqStocks, sortBy, investorData), [kosdaqStocks, sortBy, investorData])

  const isNeutral = type === "neutral"
  const isRising = type === "rising"
  const Icon = isNeutral ? BarChart3 : isRising ? TrendingUp : TrendingDown
  const iconColor = isNeutral ? "text-amber-500" : isRising ? "text-red-500" : "text-blue-500"
  const gradientFrom = isNeutral
    ? "from-amber-500/5 via-amber-500/3 to-transparent"
    : isRising
      ? "from-red-500/5 via-red-500/3 to-transparent"
      : "from-blue-500/5 via-blue-500/3 to-transparent"
  const badgeVariant = isNeutral ? "outline" : isRising ? "rising" : "falling"

  // 컴팩트 모드
  if (compactMode) {
    return (
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className={cn("py-2 sm:py-3", `bg-gradient-to-r ${gradientFrom}`)}>
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Icon className={cn("w-4 h-4", iconColor)} />
            <span className="truncate">{title}</span>
            {isAdmin && investorData && (
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                className="text-[10px] sm:text-xs bg-muted/50 border border-border rounded px-1.5 py-0.5 text-foreground ml-1"
              >
                <option value="default">기본 정렬</option>
                <option value="foreign_net">외국인순</option>
                <option value="institution_net">기관순</option>
                <option value="change_rate">등락률순</option>
              </select>
            )}
            <Badge variant={badgeVariant as any} className="ml-auto text-[9px] sm:text-[10px] shrink-0">
              {kospiStocks.length + kosdaqStocks.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-3 space-y-3">
          <div id={sectionId ? `${sectionId}-kospi` : undefined}>
          <CompactMarketSection
            market="KOSPI"
            stocks={sortedKospi}
            history={history}
            type={type}
            bgColor="bg-blue-600"
            showHeader={true}
            showTradingValue={showTradingValue}
            investorData={investorData}
            investorEstimated={investorEstimated}
            investorUpdatedAt={investorUpdatedAt}
            memberData={memberData}
            criteriaData={criteriaData}
            investorIntraday={investorIntraday}
            isAdmin={isAdmin}
            volumeProfiles={volumeProfiles}
            intradayHistory={intradayHistory}
            initialLimit={initialLimit}
            expandForCode={expandForCode}
          />
          </div>
          <div id={sectionId ? `${sectionId}-kosdaq` : undefined}>
          <CompactMarketSection
            market="KOSDAQ"
            stocks={sortedKosdaq}
            history={history}
            type={type}
            bgColor="bg-green-600"
            showHeader={true}
            showTradingValue={showTradingValue}
            investorData={investorData}
            investorEstimated={investorEstimated}
            investorUpdatedAt={investorUpdatedAt}
            memberData={memberData}
            criteriaData={criteriaData}
            investorIntraday={investorIntraday}
            isAdmin={isAdmin}
            volumeProfiles={volumeProfiles}
            intradayHistory={intradayHistory}
            initialLimit={initialLimit}
            expandForCode={expandForCode}
          />
          </div>
        </CardContent>
      </Card>
    )
  }

  // 기본 모드 (상세 보기)
  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className={cn("py-3 sm:py-4", `bg-gradient-to-r ${gradientFrom}`)}>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
          <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", iconColor)} />
          <span className="truncate">{title}</span>
          {isAdmin && investorData && (
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="text-xs bg-muted/50 border border-border rounded px-1.5 py-0.5 text-foreground ml-1"
            >
              <option value="default">기본 정렬</option>
              <option value="foreign_net">외국인순</option>
              <option value="institution_net">기관순</option>
              <option value="change_rate">등락률순</option>
            </select>
          )}
          <Badge variant={badgeVariant as any} className="ml-auto text-[10px] sm:text-xs shrink-0">
            {kospiStocks.length + kosdaqStocks.length} 종목
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 space-y-4 sm:space-y-6">
        {/* KOSPI */}
        <div id={sectionId ? `${sectionId}-kospi` : undefined}>
        <StockMarketSection
          label="KOSPI"
          dotColor="bg-blue-600"
          stocks={sortedKospi}
          history={history}
          news={news}
          type={type}
          investorData={investorData}
          investorEstimated={investorEstimated}
          investorUpdatedAt={investorUpdatedAt}
          memberData={memberData}
          criteriaData={criteriaData}
          investorIntraday={investorIntraday}
          isAdmin={isAdmin}
          dataTimestamp={dataTimestamp}
          volumeProfiles={volumeProfiles}
          vpUpdatedAt={vpUpdatedAt}
          intradayHistory={intradayHistory}
          fundamentalData={fundamentalData}
          initialLimit={initialLimit}
          expandForCode={expandForCode}
        />
        </div>

        {/* KOSDAQ */}
        <div id={sectionId ? `${sectionId}-kosdaq` : undefined}>
        <StockMarketSection
          label="KOSDAQ"
          dotColor="bg-green-600"
          stocks={sortedKosdaq}
          history={history}
          news={news}
          type={type}
          investorData={investorData}
          investorEstimated={investorEstimated}
          investorUpdatedAt={investorUpdatedAt}
          memberData={memberData}
          criteriaData={criteriaData}
          investorIntraday={investorIntraday}
          isAdmin={isAdmin}
          dataTimestamp={dataTimestamp}
          volumeProfiles={volumeProfiles}
          vpUpdatedAt={vpUpdatedAt}
          intradayHistory={intradayHistory}
          fundamentalData={fundamentalData}
          initialLimit={initialLimit}
          expandForCode={expandForCode}
        />
        </div>
      </CardContent>
    </Card>
  )
}
