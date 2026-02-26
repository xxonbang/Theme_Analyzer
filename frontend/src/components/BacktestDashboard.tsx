import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronDown, ChevronUp, BarChart3, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BacktestStats, StockDetail } from "@/hooks/useBacktestStats"

const CATEGORY_CONFIG: Record<string, { label: string; period: string }> = {
  today: { label: "당일", period: "당일" },
  short_term: { label: "단기", period: "7일 이내" },
  long_term: { label: "장기", period: "1개월 이내" },
}

const CONFIDENCE_CONFIG: Record<string, { desc: string }> = {
  "높음": { desc: "강한 확신" },
  "보통": { desc: "일반적 확신" },
  "낮음": { desc: "탐색적 분석" },
}

const CONFIDENCE_ORDER = ["높음", "보통", "낮음"]
const CATEGORY_ORDER = ["today", "short_term", "long_term"]

function ProgressBar({ accuracy }: { accuracy: number }) {
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          accuracy >= 50 ? "bg-emerald-500" : accuracy >= 30 ? "bg-amber-500" : "bg-red-400"
        )}
        style={{ width: `${Math.min(accuracy, 100)}%` }}
      />
    </div>
  )
}

function StatCell({ label, sub, total, hit, accuracy, onClick }: { label: string; sub?: string; total: number; hit: number; accuracy: number; onClick?: () => void }) {
  const content = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
      <p className="text-sm sm:text-base font-semibold">{accuracy}%</p>
      <p className="text-[10px] text-muted-foreground">{hit}/{total}</p>
    </>
  )

  if (onClick) {
    return (
      <button onClick={onClick} className="text-center space-y-1 hover:bg-muted/50 rounded-md py-1 transition-colors">
        {content}
      </button>
    )
  }
  return <div className="text-center space-y-1">{content}</div>
}

function ConfidenceDetailPopup({ confidence, details, onClose }: { confidence: string; details: StockDetail[]; onClose: () => void }) {
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

  // 날짜별 그룹
  const byDate = new Map<string, StockDetail[]>()
  for (const d of details) {
    const arr = byDate.get(d.date) || []
    arr.push(d)
    byDate.set(d.date, arr)
  }

  return createPortal(
    <div className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-full sm:w-96 sm:max-w-[90vw] max-h-[75vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-4">
        <div className="sm:hidden flex justify-center mb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{confidence} 신뢰도 상세 내역</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">
          상승률: 예측일 전일종가 대비 평가일 종가 변동률 · 적중 기준: +2% 이상
        </p>
        <div className="space-y-3">
          {[...byDate.entries()].map(([date, stocks]) => (
            <div key={date}>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">{date}</p>
              <div className="space-y-1">
                {stocks.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs sm:text-sm py-0.5">
                    <span className={cn("font-bold w-4 text-center shrink-0", s.isHit ? "text-emerald-600" : "text-red-500")}>
                      {s.isHit ? "O" : "X"}
                    </span>
                    <span className="font-medium truncate">{s.stockName}</span>
                    {s.themeName && <span className="text-[10px] text-muted-foreground truncate">({s.themeName})</span>}
                    <span className={cn("ml-auto tabular-nums font-medium shrink-0", s.returnPct > 0 ? "text-red-500" : s.returnPct < 0 ? "text-blue-500" : "")}>
                      {s.returnPct > 0 ? "+" : ""}{s.returnPct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

export function BacktestDashboard({ stats }: { stats: BacktestStats }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedConfidence, setSelectedConfidence] = useState<string | null>(null)

  if (stats.loading) return null

  const { overall } = stats
  const hasData = overall.total > 0

  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        {/* Collapsed summary — always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-muted/30 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-2 text-sm">
            <BarChart3 className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="font-medium">예측 적중률</span>
            {hasData ? (
              <span className="text-muted-foreground">
                {overall.accuracy}% ({overall.hit}/{overall.total})
              </span>
            ) : (
              <span className="text-muted-foreground">평가된 예측이 없습니다</span>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {/* Expanded detail */}
        {expanded && hasData && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-4">
            {/* 집계 기간 + 적중 기준 */}
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/40 rounded-md px-2 py-1.5">
              <Info className="w-3 h-3 shrink-0" />
              <span>
                {stats.dateRange
                  ? `${stats.dateRange.from} ~ ${stats.dateRange.to} · `
                  : ""}

                상승률: 전일종가 대비 변동률 · 적중 기준: 수익률 +2% 이상
              </span>
            </div>

            {/* 전체 적중률 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>전체 적중률</span>
                <span>{overall.accuracy}%</span>
              </div>
              <ProgressBar accuracy={overall.accuracy} />
            </div>

            {/* 신뢰도별 */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">AI 신뢰도별</p>
              <div className="grid grid-cols-3 gap-2">
                {CONFIDENCE_ORDER.map(key => {
                  const g = stats.byConfidence[key]
                  const conf = CONFIDENCE_CONFIG[key]
                  return g ? (
                    <StatCell key={key} label={key} sub={conf?.desc} total={g.total} hit={g.hit} accuracy={g.accuracy} onClick={() => setSelectedConfidence(key)} />
                  ) : null
                })}
              </div>
            </div>

            {/* 부각 시점별 */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">부각 시점별</p>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORY_ORDER.map(key => {
                  const g = stats.byCategory[key]
                  const cat = CATEGORY_CONFIG[key]
                  return g ? (
                    <StatCell key={key} label={cat?.label || key} sub={cat?.period} total={g.total} hit={g.hit} accuracy={g.accuracy} />
                  ) : null
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {selectedConfidence && stats.detailsByConfidence[selectedConfidence] && (
        <ConfidenceDetailPopup
          confidence={selectedConfidence}
          details={stats.detailsByConfidence[selectedConfidence]}
          onClose={() => setSelectedConfidence(null)}
        />
      )}
    </Card>
  )
}
