import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { KosdaqIndex } from "@/types/stock"

interface IndexAlertProps {
  data: KosdaqIndex
  label: string
}

function IndexAlert({ data, label }: IndexAlertProps) {
  const [showDetail, setShowDetail] = useState(false)

  const statusConfig = {
    "정배열": {
      bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
      icon: "📈",
      badge: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30",
    },
    "역배열": {
      bg: "bg-red-500/10 border-red-500/30 text-red-700",
      icon: "📉",
      badge: "bg-red-500/15 text-red-700 border border-red-500/30",
    },
    "혼합": {
      bg: "bg-muted border-border text-muted-foreground",
      icon: "📊",
      badge: "bg-muted text-muted-foreground border border-border",
    },
  }

  const config = statusConfig[data.status]
  const maValues = [
    { label: "MA5", value: data.ma5 },
    { label: "MA10", value: data.ma10 },
    { label: "MA20", value: data.ma20 },
    { label: "MA60", value: data.ma60 },
    { label: "MA120", value: data.ma120 },
  ]

  return (
    <button
      onClick={() => setShowDetail(!showDetail)}
      className={cn(
        "w-full text-left border rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 transition-all duration-200",
        config.bg
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm sm:text-base">{config.icon}</span>
          <span className="font-medium text-xs sm:text-sm truncate">
            {label} 이동평균선
          </span>
          <span className={cn("text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full font-semibold", config.badge)}>
            {data.status}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs sm:text-sm font-bold tabular-nums">
            {data.current.toFixed(2)}
          </span>
          {showDetail ? <ChevronUp className="w-3.5 h-3.5 opacity-60" /> : <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
        </div>
      </div>

      {showDetail && (
        <div className="mt-2 pt-2 border-t border-current/10 tabular-nums">
          {/* 현재가 헤더 */}
          <div className="flex items-baseline justify-between mb-1.5 px-0.5">
            <span className="text-[9px] sm:text-[10px] opacity-50 font-medium">현재</span>
            <span className="text-xs sm:text-sm font-bold">{data.current.toFixed(2)}</span>
          </div>
          {/* MA 값 그리드 */}
          <div className="grid grid-cols-3 gap-1">
            {maValues.filter(({ value }) => value > 0).map(({ label, value }) => {
              const gapPct = ((data.current - value) / value * 100)
              const isBelow = data.current >= value
              return (
                <div
                  key={label}
                  className={cn(
                    "rounded-md px-2 py-1.5",
                    isBelow ? "bg-emerald-500/10" : "bg-red-500/10"
                  )}
                >
                  <div className={cn(
                    "text-[9px] font-semibold leading-none",
                    isBelow ? "text-emerald-600" : "text-red-500"
                  )}>
                    {label}
                  </div>
                  <div className="text-[11px] sm:text-xs font-bold leading-tight mt-0.5">
                    {value.toFixed(2)}
                  </div>
                  <div className={cn(
                    "text-[8px] sm:text-[9px] leading-none mt-0.5 font-medium",
                    isBelow ? "text-emerald-500/70" : "text-red-400/70"
                  )}>
                    {gapPct > 0 ? "+" : ""}{gapPct.toFixed(1)}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </button>
  )
}

interface IndexAlertSectionProps {
  kospi?: KosdaqIndex
  kosdaq?: KosdaqIndex
}

export function IndexAlertSection({ kospi, kosdaq }: IndexAlertSectionProps) {
  if (!kospi && !kosdaq) return null

  return (
    <div className="mb-4 sm:mb-6 flex flex-col gap-1.5">
      {kospi && <IndexAlert data={kospi} label="코스피 지수" />}
      {kosdaq && <IndexAlert data={kosdaq} label="코스닥 지수" />}
    </div>
  )
}

// 하위 호환성을 위한 기존 export
export function KosdaqIndexAlert({ data }: { data: KosdaqIndex }) {
  return (
    <div className="mb-4 sm:mb-6">
      <IndexAlert data={data} label="코스닥 지수" />
    </div>
  )
}
