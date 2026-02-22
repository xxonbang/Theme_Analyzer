import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BacktestStats } from "@/hooks/useBacktestStats"

const CATEGORY_LABEL: Record<string, string> = {
  today: "오늘",
  short_term: "단기",
  long_term: "장기",
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

function StatCell({ label, total, hit, accuracy }: { label: string; total: number; hit: number; accuracy: number }) {
  return (
    <div className="text-center space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm sm:text-base font-semibold">{accuracy}%</p>
      <p className="text-[10px] text-muted-foreground">{hit}/{total}</p>
    </div>
  )
}

export function BacktestDashboard({ stats }: { stats: BacktestStats }) {
  const [expanded, setExpanded] = useState(false)

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
              <p className="text-xs text-muted-foreground font-medium">신뢰도별</p>
              <div className="grid grid-cols-3 gap-2">
                {CONFIDENCE_ORDER.map(key => {
                  const g = stats.byConfidence[key]
                  return g ? (
                    <StatCell key={key} label={key} total={g.total} hit={g.hit} accuracy={g.accuracy} />
                  ) : null
                })}
              </div>
            </div>

            {/* 카테고리별 */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">카테고리별</p>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORY_ORDER.map(key => {
                  const g = stats.byCategory[key]
                  return g ? (
                    <StatCell key={key} label={CATEGORY_LABEL[key] || key} total={g.total} hit={g.hit} accuracy={g.accuracy} />
                  ) : null
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
