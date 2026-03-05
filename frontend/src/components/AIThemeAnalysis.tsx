import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, ChevronDown, ChevronUp, ExternalLink, Navigation } from "lucide-react"
import { cn } from "@/lib/utils"
import { CRITERIA_CONFIG } from "@/lib/criteria"
import { CriteriaPopup } from "@/components/CriteriaPopup"
import type { ThemeAnalysis, MarketTheme, StockCriteria } from "@/types/stock"

interface AIThemeAnalysisProps {
  themeAnalysis: ThemeAnalysis
  criteriaData?: Record<string, StockCriteria>
  isAdmin?: boolean
  stockMarketMap?: Record<string, string>
  stockTradingRankMap?: Record<string, number>
  onScrollToStock?: (code: string) => void
}

function ThemeCard({ theme, index, criteriaData, isAdmin, stockMarketMap, stockTradingRankMap, onScrollToStock }: { theme: MarketTheme; index: number; criteriaData?: Record<string, StockCriteria>; isAdmin?: boolean; stockMarketMap?: Record<string, string>; stockTradingRankMap?: Record<string, number>; onScrollToStock?: (code: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [popupStockCode, setPopupStockCode] = useState<string | null>(null)
  const [popoverCode, setPopoverCode] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popoverCode) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverCode(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [popoverCode])
  const showCriteria = isAdmin && criteriaData

  return (
    <div className="border rounded-lg p-3 sm:p-4 space-y-2.5">
      {/* 테마 헤더 */}
      <div className="flex items-start gap-2">
        <Badge variant="secondary" className="shrink-0 text-[10px] sm:text-xs">
          테마 {index + 1}
        </Badge>
        <div className="min-w-0">
          <h4 className="font-semibold text-sm sm:text-base leading-tight">{theme.theme_name}</h4>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
            {theme.theme_description}
          </p>
        </div>
      </div>

      <hr className="border-border/50" />

      {/* 대장주 칩 */}
      <div className="flex items-start gap-1.5 sm:gap-2">
        <Badge variant="secondary" className="shrink-0 text-[10px] sm:text-xs mt-1">대장주</Badge>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {[...theme.leader_stocks]
          .sort((a, b) => (stockTradingRankMap?.[a.code] ?? 999) - (stockTradingRankMap?.[b.code] ?? 999))
          .map((stock) => {
          const criteria = showCriteria ? criteriaData[stock.code] : undefined
          const allMet = criteria?.all_met
          const shortWarning = criteria?.short_selling?.met
          const overheatWarning = criteria?.overheating?.met
          const reverseWarning = criteria?.reverse_alignment?.met
          const market = stockMarketMap?.[stock.code]
          const metDots = criteria ? CRITERIA_CONFIG.filter(({ key }) => {
            const c = criteria[key as keyof StockCriteria]
            return typeof c !== "boolean" && c?.met
          }) : []
          const hasDots = metDots.length > 0

          return (
            <span
              key={stock.code}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md relative",
                "text-xs sm:text-sm font-medium",
                "transition-all duration-150",
                allMet
                  ? "bg-yellow-400/15 hover:bg-yellow-400/25 text-yellow-700 ring-1 ring-yellow-400/60 animate-[shimmer_3s_ease-in-out_infinite]"
                  : market === "kosdaq"
                    ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-600"
                    : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-600"
              )}
            >
              {/* 경고 알림 뱃지 */}
              {(shortWarning || overheatWarning || reverseWarning) && (
                <span className={cn(
                  "absolute -top-1 -right-1 w-2 h-2 rounded-full border border-card animate-pulse",
                  shortWarning ? "bg-red-500" : overheatWarning ? "bg-amber-500" : "bg-indigo-500"
                )} />
              )}
              {stockTradingRankMap?.[stock.code] != null && (
                <span
                  title={`거래대금 ${stockTradingRankMap[stock.code]}위`}
                  className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-foreground/10 text-[9px] sm:text-[10px] font-bold leading-none shrink-0"
                >
                  {stockTradingRankMap[stock.code]}
                </span>
              )}
              {hasDots && (
                <button
                  onClick={() => setPopupStockCode(popupStockCode === stock.code ? null : stock.code)}
                  className="inline-flex items-center gap-px mr-0.5 hover:opacity-70 transition-opacity"
                >
                  {metDots.map(({ key, dot }) => (
                    <span key={key} className={cn("w-1.5 h-1.5 rounded-full", dot)} />
                  ))}
                </button>
              )}
              <button
                onClick={() => setPopoverCode(popoverCode === stock.code ? null : stock.code)}
                className="inline-flex items-center gap-1 hover:underline cursor-pointer"
              >
                {stock.name}
              </button>
              {popoverCode === stock.code && (
                <div ref={popoverRef} className="absolute top-full left-0 mt-1.5 bg-popover border border-border/80 rounded-lg shadow-xl p-1 z-30 min-w-[160px]">
                  <button
                    onClick={() => {
                      window.open(`https://m.stock.naver.com/domestic/stock/${stock.code}/total`, '_blank')
                      setPopoverCode(null)
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-muted rounded-md cursor-pointer text-left text-[13px] font-medium text-foreground/90 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    네이버 보기
                  </button>
                  <div className="mx-2 border-t border-border/40" />
                  <button
                    onClick={() => {
                      onScrollToStock?.(stock.code)
                      setPopoverCode(null)
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-muted rounded-md cursor-pointer text-left text-[13px] font-medium text-foreground/90 transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    종목으로 이동
                  </button>
                </div>
              )}
              {/* Criteria popup */}
              {popupStockCode === stock.code && criteria && (
                <CriteriaPopup stockName={stock.name} criteria={criteria} onClose={() => setPopupStockCode(null)} />
              )}
            </span>
          )
        })}
        </div>
      </div>

      <hr className="border-border/50" />

      {/* 뉴스 근거 토글 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-1 text-xs text-muted-foreground",
          "hover:text-foreground transition-colors duration-150"
        )}
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? "뉴스 근거 접기" : "뉴스 근거 보기"}
      </button>

      {/* 뉴스 근거 상세 */}
      {expanded && (
        <div className="space-y-3">
          {theme.leader_stocks.map((stock) => (
            <div key={stock.code} className="pt-2 first:pt-0">
              <div className="mb-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-foreground/5 font-semibold text-xs sm:text-sm">
                  {stock.name}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed mb-2 pl-0.5">
                {stock.reason}
              </p>
              {stock.news_evidence.length > 0 && (
                <ul className="space-y-1 pl-0.5">
                  {stock.news_evidence.map((news, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] sm:text-xs">
                      <span className="text-muted-foreground/50 shrink-0 mt-px">{'•'}</span>
                      <a
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground hover:underline transition-colors break-words"
                      >
                        {news.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AIThemeAnalysis({ themeAnalysis, criteriaData, isAdmin, stockMarketMap, stockTradingRankMap, onScrollToStock }: AIThemeAnalysisProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (!themeAnalysis?.themes?.length) {
    return null
  }

  const themeCount = themeAnalysis.themes.length

  return (
    <Card className="mb-4 sm:mb-6 shadow-sm border-amber-500/20 bg-gradient-to-br from-amber-500/[0.03] to-transparent">
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* 헤더 (클릭으로 전체 토글) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
            <span className="font-semibold text-sm sm:text-base">AI 테마 분석</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              ({themeAnalysis.analysis_date} {themeAnalysis.analyzed_at.split(" ")[1]} 분석)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-[10px] sm:text-xs">{themeCount}개 테마</Badge>
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </button>

        {/* 시장 요약 (항상 표시) */}
        <p className="text-xs sm:text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 leading-relaxed">
          {themeAnalysis.market_summary}
        </p>

        {/* 테마 카드 (접기/펼치기) */}
        {!collapsed && (
          <div className="space-y-2.5">
            {themeAnalysis.themes.map((theme, index) => (
              <ThemeCard key={index} theme={theme} index={index} criteriaData={criteriaData} isAdmin={isAdmin} stockMarketMap={stockMarketMap} stockTradingRankMap={stockTradingRankMap} onScrollToStock={onScrollToStock} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
