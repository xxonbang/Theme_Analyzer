import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, TrendingUp, Calendar, Clock, ExternalLink, ChevronDown, ChevronUp, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useThemeForecast } from "@/hooks/useThemeForecast"
import type { ForecastTheme, ForecastStock } from "@/types/stock"

const CONFIDENCE_CONFIG = {
  "높음": { badge: "bg-red-100 text-red-700", dot: "bg-red-500" },
  "보통": { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  "낮음": { badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
} as const

function LeaderStockChip({ stock }: { stock: ForecastStock }) {
  const naverUrl = `https://m.stock.naver.com/domestic/stock/${stock.code}/total`
  return (
    <a
      href={naverUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md",
        "text-xs sm:text-sm font-medium",
        "transition-all duration-150 hover:shadow-sm",
        stock.data_verified
          ? "bg-blue-500/10 hover:bg-blue-500/20 text-blue-600"
          : "bg-slate-500/10 hover:bg-slate-500/15 text-slate-500"
      )}
    >
      <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-foreground/10 text-[9px] sm:text-[10px] font-bold leading-none shrink-0">
        {stock.priority}
      </span>
      <span>{stock.name}</span>
      <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
      {!stock.data_verified && (
        <span className="text-[8px] text-amber-500 shrink-0" title="전일 데이터 미확인">추정</span>
      )}
    </a>
  )
}

function ForecastThemeCard({ theme }: { theme: ForecastTheme }) {
  const [expanded, setExpanded] = useState(false)
  const config = CONFIDENCE_CONFIG[theme.confidence] || CONFIDENCE_CONFIG["보통"]

  return (
    <div className="border rounded-lg p-3 sm:p-4 space-y-2.5">
      {/* 헤더: 테마명 + 신뢰도 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm sm:text-base leading-tight">{theme.theme_name}</h4>
            <Badge className={cn("text-[10px] sm:text-xs shrink-0", config.badge)}>
              <span className={cn("w-1.5 h-1.5 rounded-full mr-1", config.dot)} />
              {theme.confidence}
            </Badge>
            {theme.target_period && (
              <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {theme.target_period}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            {theme.description}
          </p>
        </div>
      </div>

      {/* 촉매 */}
      <div className="flex items-start gap-1.5 text-xs sm:text-sm">
        <span className="text-amber-500 shrink-0 mt-0.5">⚡</span>
        <span className="text-foreground/80">{theme.catalyst}</span>
      </div>

      <hr className="border-border/50" />

      {/* 대장주 */}
      <div className="flex items-start gap-1.5 sm:gap-2">
        <Badge variant="secondary" className="shrink-0 text-[10px] sm:text-xs mt-1">대장주</Badge>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {theme.leader_stocks.map((stock) => (
            <LeaderStockChip key={stock.code} stock={stock} />
          ))}
        </div>
      </div>

      {/* 선정 근거 토글 */}
      {theme.leader_stocks.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "선정 근거 접기" : "선정 근거 보기"}
          </button>

          {expanded && (
            <div className="space-y-2 pl-0.5">
              {theme.leader_stocks.map((stock) => (
                <div key={stock.code} className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">{stock.priority}. {stock.name}</span>
                  {!stock.data_verified && <span className="text-amber-500 ml-1">(전일 데이터 미확인)</span>}
                  <p className="mt-0.5 pl-3">{stock.reason}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ForecastSection({ title, icon, themes, emptyText }: {
  title: string
  icon: React.ReactNode
  themes: ForecastTheme[]
  emptyText: string
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-semibold text-sm sm:text-base">{title}</span>
        <Badge variant="secondary" className="text-[10px] sm:text-xs">{themes.length}개</Badge>
      </div>
      {themes.length > 0 ? (
        <div className="space-y-2.5">
          {themes.map((theme, idx) => (
            <ForecastThemeCard key={idx} theme={theme} />
          ))}
        </div>
      ) : (
        <p className="text-xs sm:text-sm text-muted-foreground py-3 text-center bg-muted/30 rounded-lg">
          {emptyText}
        </p>
      )}
    </div>
  )
}

export function ThemeForecastPage() {
  const { data, loading, error } = useThemeForecast()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span className="text-sm">예측 데이터 로딩 중...</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {error || "아직 예측 데이터가 없습니다. 다음 장 개장 전(오전 7:30)에 생성됩니다."}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 카드 */}
      <Card className="shadow-sm">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              <span className="font-semibold text-sm sm:text-base">AI 유망 테마 예측</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                ({data.forecast_date} {data.generated_at.split(" ")[1]} 생성)
              </span>
            </div>
          </div>

          {/* 시장 환경 */}
          <div className="space-y-1.5">
            <p className="text-xs sm:text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 leading-relaxed">
              {data.market_context}
            </p>
            {data.us_market_summary && (
              <p className="text-xs sm:text-sm text-muted-foreground bg-blue-500/5 rounded-md px-3 py-2 leading-relaxed">
                🇺🇸 {data.us_market_summary}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 오늘의 유망 테마 */}
      <Card className="shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <ForecastSection
            title="오늘의 유망 테마"
            icon={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />}
            themes={data.today}
            emptyText="오늘의 유망 테마가 없습니다"
          />
        </CardContent>
      </Card>

      {/* 단기 유망 테마 */}
      <Card className="shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <ForecastSection
            title="단기 유망 테마 (7일 이내)"
            icon={<Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />}
            themes={data.short_term}
            emptyText="단기 유망 테마가 없습니다"
          />
        </CardContent>
      </Card>

      {/* 장기 유망 테마 */}
      <Card className="shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <ForecastSection
            title="장기 유망 테마 (1개월 이내)"
            icon={<Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />}
            themes={data.long_term}
            emptyText="장기 유망 테마가 없습니다"
          />
        </CardContent>
      </Card>
    </div>
  )
}
