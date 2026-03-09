import { useState } from "react"
import { ChevronDown, ChevronUp, ArrowLeftRight } from "lucide-react"
import type { ExchangeData } from "@/types/stock"

interface ExchangeRateProps {
  exchange: ExchangeData
}

const currencyInfo: Record<string, { flag: string; label: string }> = {
  USD: { flag: "🇺🇸", label: "USD" },
  JPY: { flag: "🇯🇵", label: "JPY(100)" },
  EUR: { flag: "🇪🇺", label: "EUR" },
  CNY: { flag: "🇨🇳", label: "CNY" },
}

export function ExchangeRate({ exchange }: ExchangeRateProps) {
  const [expanded, setExpanded] = useState(false)

  if (!exchange?.rates?.length) {
    return null
  }

  const usd = exchange.rates.find((r) => r.currency === "USD")

  return (
    <div className="mb-3 sm:mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full cursor-pointer group text-left"
      >
        {/* 헤더 */}
        <div className="flex items-center px-1 py-1">
          <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <span className="text-xs font-semibold text-foreground/80 ml-1.5">환율</span>
          {exchange.timestamp && (
            <span className="text-[10px] text-muted-foreground/35 tabular-nums ml-1.5">{exchange.timestamp.slice(5, 10).replace("-", "/")} · {exchange.timestamp.slice(11, 16)}</span>
          )}
          <span className="ml-auto text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>

        {/* 접힌 상태: USD 한 줄 바 */}
        {!expanded && usd && (() => {
          const change = usd.change
          const isUp = change != null && change > 0
          const isDown = change != null && change < 0
          return (
            <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-md mt-1 ${isUp ? "bg-red-500/[0.04]" : isDown ? "bg-blue-500/[0.04]" : "bg-card/80"} border border-border/20`}>
              <span className="text-[10px] text-muted-foreground/55 font-medium">🇺🇸 USD</span>
              <span className="flex items-center gap-2">
                <span className="text-[12px] tabular-nums font-semibold text-foreground/90">
                  {usd.rate.toLocaleString()}<span className="text-muted-foreground/40 text-[10px] font-normal ml-0.5">원</span>
                </span>
                {change != null && change !== 0 && (
                  <span className={`text-[10px] tabular-nums font-medium ${isUp ? "text-red-500" : "text-blue-500"}`}>
                    {isUp ? "▲" : "▼"}{Math.abs(change).toLocaleString()}
                  </span>
                )}
              </span>
            </div>
          )
        })()}
      </button>

      {/* 펼친 상태 */}
      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5 px-1">
          {exchange.rates.map((rate) => {
            const info = currencyInfo[rate.currency] || { flag: "💵", label: rate.currency }
            const change = rate.change
            const isUp = change != null && change > 0
            const isDown = change != null && change < 0
            const accent = isUp ? "border-l-red-500/60" : isDown ? "border-l-blue-500/60" : "border-l-border"

            return (
              <div
                key={rate.currency}
                className={`rounded-md border border-border/50 border-l-2 ${accent} bg-card/60 backdrop-blur-sm px-2.5 py-2 flex flex-col gap-1 transition-colors hover:bg-card`}
              >
                <span className="text-[10px] text-muted-foreground/60 font-medium leading-none">
                  {info.flag} {info.label}
                </span>
                <span className="text-[13px] font-bold tabular-nums tracking-tight leading-none text-foreground">
                  {rate.rate.toLocaleString()}<span className="text-muted-foreground/40 text-[10px] font-normal ml-0.5">원</span>
                </span>
                <span className={`text-[10px] font-medium tabular-nums leading-none ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}>
                  {change != null && change !== 0
                    ? `${isUp ? "▲" : "▼"} ${Math.abs(change).toLocaleString()}${rate.change_rate ? ` (${rate.change_rate > 0 ? "+" : ""}${rate.change_rate.toFixed(2)}%)` : ""}`
                    : "— 0"}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
