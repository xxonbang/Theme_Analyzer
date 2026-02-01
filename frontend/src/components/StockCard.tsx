import { TrendingUp, TrendingDown, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatPrice, formatVolume, formatChangeRate, getChangeBgColor } from "@/lib/utils"
import type { Stock, StockHistory } from "@/types/stock"

interface StockCardProps {
  stock: Stock
  history?: StockHistory
  type: "rising" | "falling"
}

export function StockCard({ stock, history, type }: StockCardProps) {
  const isRising = type === "rising"
  const TrendIcon = isRising ? TrendingUp : TrendingDown
  const naverUrl = `https://m.stock.naver.com/domestic/stock/${stock.code}/total`

  return (
    <Card className="group hover:shadow-md transition-all duration-200 hover:border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Rank & Name */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0",
              isRising ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
            )}>
              {stock.rank}
            </div>
            <div className="min-w-0">
              <a
                href={naverUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1 group/link"
              >
                <span className="truncate">{stock.name}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
              </a>
              <p className="text-xs text-muted-foreground font-mono">{stock.code}</p>
            </div>
          </div>

          {/* Price & Change */}
          <div className="text-right shrink-0">
            <p className="font-semibold tabular-nums">
              {formatPrice(stock.current_price)}
              <span className="text-muted-foreground text-sm ml-0.5">원</span>
            </p>
            <Badge variant={isRising ? "rising" : "falling"} className="mt-1">
              <TrendIcon className="w-3 h-3 mr-1" />
              {formatChangeRate(stock.change_rate)}
            </Badge>
          </div>
        </div>

        {/* Volume & History */}
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            거래량 <span className="font-medium text-foreground">{formatVolume(stock.volume)}</span>
          </span>

          {history && history.changes && history.changes.length > 0 && (
            <div className="flex items-center gap-1.5">
              {[...history.changes].reverse().map((change, idx) => {
                const labels = ["D-2", "D-1", "D"]
                return (
                  <span
                    key={idx}
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
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
      </CardContent>
    </Card>
  )
}
