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
  today: "당일",
  short_term: "단기",
  long_term: "장기",
}

type CategoryFilter = "all" | "today" | "short_term" | "long_term"

/** 필터 기준으로 종목의 수익률·적중 여부를 결정 */
function getStockDisplay(stock: StockPrediction, filter: CategoryFilter): { returnPct: number | null; hit: boolean | null } {
  if (filter !== "all") {
    if (!stock.evaluatedByCategory[filter]) return { returnPct: null, hit: null }
    const ret = stock.returnByCategory[filter] ?? null
    return { returnPct: ret, hit: ret != null ? ret >= 2.0 : null }
  }
  // 전체: 카테고리가 1개면 평가, 여러 개면 보류
  const categories = [...new Set(stock.themes.map(t => t.category))]
  if (categories.length > 1) return { returnPct: null, hit: null }
  const cat = categories[0]
  if (!stock.evaluatedByCategory[cat]) return { returnPct: null, hit: null }
  const ret = stock.returnByCategory[cat] ?? null
  return { returnPct: ret, hit: ret != null ? ret >= 2.0 : null }
}

function ThemeListPopup({ stockName, stockCode, themes, onClose }: {
  stockName: string; stockCode: string
  themes: StockPrediction["themes"]
  onClose: () => void
}) {
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
      <div className="relative w-full sm:w-80 sm:max-w-[90vw] max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-4">
        <div className="sm:hidden flex justify-center mb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold">{stockName} ({stockCode}) 예측 테마</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {themes.map((t, i) => {
            const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.active
            return (
              <div key={i} className="rounded-lg bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge className={cn("text-[10px] px-1.5 py-0.5 font-semibold", sc.cls)}>{sc.label}</Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                    {CATEGORY_LABEL[t.category] || t.category}
                  </Badge>
                  <span className="ml-auto text-[10px] text-muted-foreground">신뢰도 {t.confidence}</span>
                </div>
                <span className="text-sm font-medium">{t.theme_name}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

function StockRow({ stock, categoryFilter }: { stock: StockPrediction; categoryFilter: CategoryFilter }) {
  const [showThemes, setShowThemes] = useState(false)
  const { returnPct, hit } = getStockDisplay(stock, categoryFilter)
  const filteredThemes = categoryFilter === "all" ? stock.themes : stock.themes.filter(t => t.category === categoryFilter)

  const hitIcon = hit === true ? "O" : hit === false ? "X" : "-"
  const hitColor = hit === true ? "text-emerald-600" : hit === false ? "text-red-500" : "text-slate-400"

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
        {returnPct != null && (
          <span className={cn("tabular-nums font-medium shrink-0", returnPct > 0 ? "text-red-500" : returnPct < 0 ? "text-blue-500" : "")}>
            {returnPct > 0 ? "+" : ""}{returnPct}%
          </span>
        )}
        <button
          onClick={() => setShowThemes(true)}
          className="ml-auto text-[10px] text-violet-500 hover:text-violet-700 whitespace-nowrap shrink-0"
        >
          {filteredThemes.length}개 테마
        </button>
      </div>
      {showThemes && (
        <ThemeListPopup
          stockName={stock.name}
          stockCode={stock.code}
          themes={filteredThemes}
          onClose={() => setShowThemes(false)}
        />
      )}
    </>
  )
}

function filterStocks(stocks: StockPrediction[], filter: CategoryFilter) {
  if (filter === "all") return stocks
  return stocks.filter(s => s.themes.some(t => t.category === filter))
}

function DateGroup({ group, categoryFilter }: { group: StockPredictionsByDate; categoryFilter: CategoryFilter }) {
  const [expanded, setExpanded] = useState(false)
  const filtered = filterStocks(group.stocks, categoryFilter)
  const stocks = [...filtered].sort((a, b) => {
    const ra = getStockDisplay(a, categoryFilter).returnPct
    const rb = getStockDisplay(b, categoryFilter).returnPct
    return (rb ?? -999) - (ra ?? -999)
  })

  const displays = stocks.map(s => getStockDisplay(s, categoryFilter))
  const evaluable = displays.filter(d => d.hit != null)
  const hitCount = evaluable.filter(d => d.hit).length
  const missCount = evaluable.length - hitCount

  if (stocks.length === 0) return null

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-2 px-1 text-left hover:bg-muted/30 transition-colors rounded"
      >
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="font-medium tabular-nums">{group.date}</span>
          <span className="text-muted-foreground">{stocks.length}종목</span>
          {hitCount > 0 && <span className="text-emerald-600 text-[10px]">{hitCount}적중</span>}
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
          {stocks.map(stock => (
            <StockRow key={stock.code} stock={stock} categoryFilter={categoryFilter} />
          ))}
        </div>
      )}
    </div>
  )
}

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "today", label: "당일" },
  { value: "short_term", label: "단기" },
  { value: "long_term", label: "장기" },
]

export function PredictionHistory({ stockDates }: { stockDates: StockPredictionsByDate[] }) {
  const [expanded, setExpanded] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")

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
            <span className="text-muted-foreground">
              {stockDates.length}일
              {stockDates.length > 0 && (
                <span className="ml-1 text-[10px]">
                  ({stockDates[stockDates.length - 1].date.replace(/-/g, ".")} ~ {stockDates[0].date.replace(/-/g, ".")})
                </span>
              )}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {expanded && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            <div className="flex gap-1 mb-2">
              {CATEGORY_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setCategoryFilter(f.value)}
                  className={cn(
                    "text-[10px] sm:text-xs px-2 py-0.5 rounded-full border transition-colors",
                    categoryFilter === f.value
                      ? "bg-violet-100 text-violet-700 border-violet-300"
                      : "text-muted-foreground border-border hover:bg-muted/50"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {stockDates.map(group => (
              <DateGroup key={group.date} group={group} categoryFilter={categoryFilter} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
