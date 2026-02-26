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
      bg: "bg-emerald-50 border-emerald-200 text-emerald-700",
      icon: "📈",
      badge: "bg-emerald-100 text-emerald-800 border border-emerald-300",
    },
    "역배열": {
      bg: "bg-red-50 border-red-200 text-red-700",
      icon: "📉",
      badge: "bg-red-100 text-red-800 border border-red-300",
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
        <div className="mt-2 pt-2 border-t border-current/10 flex flex-wrap gap-x-3 gap-y-1 text-[10px] sm:text-xs tabular-nums">
          <span className="font-bold">현재 {data.current.toFixed(2)}</span>
          {maValues.filter(({ value }) => value > 0).map(({ label, value }) => (
            <span
              key={label}
              className={cn(
                "font-medium",
                value <= data.current ? "text-emerald-600" : "text-red-500"
              )}
            >
              {label} {value.toFixed(2)}
            </span>
          ))}
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
