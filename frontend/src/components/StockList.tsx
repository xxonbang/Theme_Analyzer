import { TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StockCard } from "@/components/StockCard"
import type { Stock, StockHistory } from "@/types/stock"

interface StockListProps {
  title: string
  kospiStocks: Stock[]
  kosdaqStocks: Stock[]
  history: Record<string, StockHistory>
  type: "rising" | "falling"
}

export function StockList({ title, kospiStocks, kosdaqStocks, history, type }: StockListProps) {
  const isRising = type === "rising"
  const Icon = isRising ? TrendingUp : TrendingDown

  return (
    <Card className="overflow-hidden">
      <CardHeader className={isRising ? "bg-gradient-to-r from-red-500/5 to-transparent" : "bg-gradient-to-r from-blue-500/5 to-transparent"}>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Icon className={isRising ? "text-red-500" : "text-blue-500"} />
          {title}
          <Badge variant={isRising ? "rising" : "falling"} className="ml-auto">
            {kospiStocks.length + kosdaqStocks.length} 종목
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        {/* KOSPI */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-blue-600" />
            <h3 className="font-semibold text-lg">KOSPI</h3>
            <span className="text-sm text-muted-foreground">({kospiStocks.length})</span>
          </div>
          {kospiStocks.length > 0 ? (
            <div className="grid gap-3">
              {kospiStocks.map((stock) => (
                <StockCard
                  key={stock.code}
                  stock={stock}
                  history={history[stock.code]}
                  type={type}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-4 text-center">해당 종목 없음</p>
          )}
        </div>

        {/* KOSDAQ */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-green-600" />
            <h3 className="font-semibold text-lg">KOSDAQ</h3>
            <span className="text-sm text-muted-foreground">({kosdaqStocks.length})</span>
          </div>
          {kosdaqStocks.length > 0 ? (
            <div className="grid gap-3">
              {kosdaqStocks.map((stock) => (
                <StockCard
                  key={stock.code}
                  stock={stock}
                  history={history[stock.code]}
                  type={type}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-4 text-center">해당 종목 없음</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
