import { TrendingUp, TrendingDown, ExternalLink, Newspaper } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatPrice, formatVolume, formatChangeRate, getChangeBgColor } from "@/lib/utils"
import type { Stock, StockHistory, StockNews } from "@/types/stock"

interface StockCardProps {
  stock: Stock
  history?: StockHistory
  news?: StockNews
  type: "rising" | "falling"
}

export function StockCard({ stock, history, news, type }: StockCardProps) {
  const isRising = type === "rising"
  const TrendIcon = isRising ? TrendingUp : TrendingDown
  const naverUrl = `https://m.stock.naver.com/domestic/stock/${stock.code}/total`

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:border-primary/30 bg-card">
      <CardContent className="p-3 sm:p-4">
        {/* Main Info Row */}
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          {/* Rank & Name */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className={cn(
              "flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-bold shrink-0",
              isRising ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600"
            )}>
              {stock.rank}
            </div>
            <div className="min-w-0">
              <a
                href={naverUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-sm sm:text-base text-foreground hover:text-primary transition-colors flex items-center gap-1 group/link"
              >
                <span className="truncate">{stock.name}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
              </a>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">{stock.code}</p>
            </div>
          </div>

          {/* Price & Change */}
          <div className="text-right shrink-0">
            <p className="font-semibold text-sm sm:text-base tabular-nums">
              {formatPrice(stock.current_price)}
              <span className="text-muted-foreground text-xs sm:text-sm ml-0.5">원</span>
            </p>
            <Badge variant={isRising ? "rising" : "falling"} className="mt-1 text-[10px] sm:text-xs">
              <TrendIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
              {formatChangeRate(stock.change_rate)}
            </Badge>
          </div>
        </div>

        {/* Volume & History Row */}
        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <span className="text-muted-foreground">
              거래량 <span className="font-medium text-foreground">{formatVolume(stock.volume)}</span>
            </span>

            {history && history.changes && history.changes.length > 0 && (
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                {[...history.changes].reverse().map((change, idx) => {
                  const labels = ["D-2", "D-1", "D"]
                  return (
                    <span
                      key={idx}
                      className={cn(
                        "text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded font-medium",
                        getChangeBgColor(change.change_rate)
                      )}
                    >
                      {labels[idx]} {change.change_rate > 0 ? "+" : ""}{change.change_rate.toFixed(1)}%
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* News Section */}
        {news && news.news && news.news.length > 0 && (
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50">
            <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
              <Newspaper className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" />
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">관련 뉴스</span>
            </div>
            <ul className="space-y-1 sm:space-y-1.5">
              {news.news.slice(0, 3).map((item, idx) => (
                <li key={idx}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] sm:text-xs text-muted-foreground hover:text-primary transition-colors line-clamp-1 block"
                    title={item.title}
                  >
                    • {item.title.replace(/<[^>]*>/g, '')}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
