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
    <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 py-2.5 border-b border-border/30">
      <span className="text-xs text-muted-foreground shrink-0">
        💱 환율 <span className="hidden sm:inline">({formatDate(exchange.search_date)})</span>
        {exchange.timestamp && <span className="text-[10px] text-muted-foreground/50 ml-1">{exchange.timestamp.slice(11, 16)}</span>}
      </span>
      {exchange.rates.map((rate) => {
        const info = currencyInfo[rate.currency] || { emoji: "💵", name: rate.currency_name }
        const unit = rate.is_100 ? "(100)" : ""

        return (
          <div key={rate.currency} className="flex items-center gap-1.5 text-sm">
            <span className="text-sm">{info.emoji}</span>
            <span className="text-muted-foreground/80 text-xs">{rate.currency}{unit}</span>
            <span className="font-semibold tabular-nums tracking-tight">{rate.rate.toLocaleString()}<span className="text-muted-foreground/60 text-xs font-normal ml-0.5">원</span></span>
          </div>
        )
      })}
    </div>
  )
}
