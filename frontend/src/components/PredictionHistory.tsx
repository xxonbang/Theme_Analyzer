import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, History, X, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StockPrediction, StockPredictionsByDate } from "@/hooks/usePredictionHistory"

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  hit: { label: "적중", cls: "bg-emerald-100 text-emerald-700" },
  missed: { label: "미스", cls: "bg-red-100 text-red-700" },
  expired: { label: "만료", cls: "bg-slate-100 text-slate-500" },
  active: { label: "평가중", cls: "bg-blue-100 text-blue-600" },
}

const CATEGORY_LABEL: Record<string, string> = {
  today: "오늘",
  short_term: "단기",
  long_term: "장기",
}

function ThemeListPopup({ stock, onClose }: { stock: StockPrediction; onClose: () => void }) {
  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = "0"
    document.body.style.right = "0"
    return () => {
      document.body.style.overflow = ""
      document.body.style.position = ""
      document.body.style.top = ""
      document.body.style.left = ""
      document.body.style.right = ""
      window.scrollTo(0, scrollY)
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-full sm:w-80 sm:max-w-[90vw] max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 sm:p-4">
        <div className="sm:hidden flex justify-center mb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{stock.name} ({stock.code}) 예측 테마</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {stock.themes.map((t, i) => {
            const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.active
            return (
              <div key={i} className="flex items-center gap-1.5 flex-wrap">
                <Badge className={cn("text-[9px] px-1.5 py-0", sc.cls)}>{sc.label}</Badge>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  {CATEGORY_LABEL[t.category] || t.category}
                </Badge>
                <span className="text-xs truncate">{t.theme_name}</span>
                <span className="text-[10px] text-muted-foreground">{t.confidence}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

function StockRow({ stock }: { stock: StockPrediction }) {
  const [showThemes, setShowThemes] = useState(false)

  const hitIcon = stock.hit === true ? "O" : stock.hit === false ? "X" : "-"
  const hitColor = stock.hit === true ? "text-emerald-600" : stock.hit === false ? "text-red-500" : "text-slate-400"

  return (
    <>
      <div className="flex items-center gap-1.5 py-1.5 text-xs sm:text-sm">
        <span className={cn("font-bold w-4 text-center shrink-0", hitColor)}>{hitIcon}</span>
        <a
          href={`https://m.stock.naver.com/domestic/stock/${stock.code}/total`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium truncate hover:underline inline-flex items-center gap-0.5"
        >
          {stock.name}
          <span className="text-[10px] text-muted-foreground">({stock.code})</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-30 shrink-0" />
        </a>
        {stock.returnPct != null && (
          <span className={cn("tabular-nums font-medium shrink-0", stock.returnPct > 0 ? "text-red-500" : stock.returnPct < 0 ? "text-blue-500" : "")}>
            {stock.returnPct > 0 ? "+" : ""}{stock.returnPct}%
          </span>
        )}
        {stock.excess != null && (
          <span className={cn("text-[10px] tabular-nums shrink-0", stock.excess > 0 ? "text-red-400" : "text-blue-400")}>
            초과{stock.excess > 0 ? "+" : ""}{stock.excess}%p
          </span>
        )}
        <button
          onClick={() => setShowThemes(true)}
          className="ml-auto text-[10px] text-violet-500 hover:text-violet-700 whitespace-nowrap shrink-0"
        >
          {stock.themes.length}개 테마
        </button>
      </div>
      {showThemes && <ThemeListPopup stock={stock} onClose={() => setShowThemes(false)} />}
    </>
  )
}

function DateGroup({ group }: { group: StockPredictionsByDate }) {
  const [expanded, setExpanded] = useState(false)
  const missCount = group.totalEvaluable - group.hitCount

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-2 px-1 text-left hover:bg-muted/30 transition-colors rounded"
      >
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="font-medium tabular-nums">{group.date}</span>
          <span className="text-muted-foreground">{group.stocks.length}종목</span>
          {group.hitCount > 0 && <span className="text-emerald-600 text-[10px]">{group.hitCount}적중</span>}
          {missCount > 0 && <span className="text-red-500 text-[10px]">{missCount}미스</span>}
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-1 pb-2 space-y-0.5">
          {group.stocks.map(stock => (
            <StockRow key={stock.code} stock={stock} />
          ))}
        </div>
      )}
    </div>
  )
}

export function PredictionHistory({ stockDates }: { stockDates: StockPredictionsByDate[] }) {
  const [expanded, setExpanded] = useState(false)

  if (stockDates.length === 0) return null

  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-muted/30 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-2 text-sm">
            <History className="w-4 h-4 text-violet-500 shrink-0" />
            <span className="font-medium">예측 이력</span>
            <span className="text-muted-foreground">{stockDates.length}일</span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {expanded && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            {stockDates.map(group => (
              <DateGroup key={group.date} group={group} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
