import { Card, CardContent } from "@/components/ui/card"
import type { ExchangeData } from "@/types/stock"

interface ExchangeRateProps {
  exchange: ExchangeData
}

const currencyInfo: Record<string, { emoji: string; name: string }> = {
  USD: { emoji: "🇺🇸", name: "미국 달러" },
  JPY: { emoji: "🇯🇵", name: "일본 엔" },
  EUR: { emoji: "🇪🇺", name: "유로" },
  CNY: { emoji: "🇨🇳", name: "중국 위안" },
}

export function ExchangeRate({ exchange }: ExchangeRateProps) {
  if (!exchange?.rates?.length) {
    return null
  }

  // 기준일 포맷팅
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6)}`
  }

  return (
    <Card className="mb-4 sm:mb-6 overflow-hidden shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          {/* 제목 */}
          <div className="flex items-center gap-2">
            <span className="text-lg sm:text-xl">💱</span>
            <span className="font-semibold text-sm sm:text-base">실시간 환율</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              (기준일: {formatDate(exchange.search_date)})
            </span>
          </div>

          {/* 환율 목록 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
            {exchange.rates.map((rate) => {
              const info = currencyInfo[rate.currency] || { emoji: "💵", name: rate.currency_name }
              const unit = rate.is_100 ? "(100)" : ""

              return (
                <div key={rate.currency} className="flex items-center gap-1 text-xs sm:text-sm">
                  <span>{info.emoji}</span>
                  <span className="text-muted-foreground">{rate.currency}{unit}</span>
                  <span className="font-semibold tabular-nums">{rate.rate.toLocaleString()}원</span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
