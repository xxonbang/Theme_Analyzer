import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, History, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PredictionsByDate, PredictionRecord } from "@/hooks/usePredictionHistory"

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

function PredictionRow({ pred }: { pred: PredictionRecord }) {
  const sc = STATUS_CONFIG[pred.status] || STATUS_CONFIG.active
  const perf = pred.actual_performance
  const indexReturn = perf?.index_return

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={cn("text-[9px] sm:text-[10px] px-1.5 py-0", sc.cls)}>{sc.label}</Badge>
          <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1.5 py-0">
            {CATEGORY_LABEL[pred.category] || pred.category}
          </Badge>
          <span className="text-xs sm:text-sm font-medium truncate">{pred.theme_name}</span>
          <span className="text-[10px] text-muted-foreground">{pred.confidence}</span>
        </div>
        {/* 대장주 + 수익률 */}
        {pred.leader_stocks.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 pl-0.5">
            {pred.leader_stocks.slice(0, 3).map((s) => {
              const ret = perf?.[s.code]
              return (
                <a
                  key={s.code}
                  href={`https://m.stock.naver.com/domestic/stock/${s.code}/total`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {s.name}
                  {ret != null && (
                    <span className={cn(
                      "font-medium",
                      ret > 0 ? "text-red-500" : ret < 0 ? "text-blue-500" : ""
                    )}>
                      {ret > 0 ? "+" : ""}{ret}%
                    </span>
                  )}
                  <ExternalLink className="w-2.5 h-2.5 opacity-30" />
                </a>
              )
            })}
            {indexReturn != null && (
              <span className="text-[10px] text-muted-foreground">
                KOSPI {indexReturn > 0 ? "+" : ""}{indexReturn}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DateGroup({ group }: { group: PredictionsByDate }) {
  const [expanded, setExpanded] = useState(false)
  const hitCount = group.predictions.filter(p => p.status === "hit").length
  const missCount = group.predictions.filter(p => p.status === "missed").length
  const activeCount = group.predictions.filter(p => p.status === "active").length

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-2 px-1 text-left hover:bg-muted/30 transition-colors rounded"
      >
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="font-medium tabular-nums">{group.date}</span>
          <span className="text-muted-foreground">
            {group.predictions.length}건
          </span>
          {hitCount > 0 && <span className="text-emerald-600 text-[10px]">{hitCount}적중</span>}
          {missCount > 0 && <span className="text-red-500 text-[10px]">{missCount}미스</span>}
          {activeCount > 0 && <span className="text-blue-500 text-[10px]">{activeCount}평가중</span>}
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-1 pb-2 space-y-0.5">
          {group.predictions.map(pred => (
            <PredictionRow key={pred.id} pred={pred} />
          ))}
        </div>
      )}
    </div>
  )
}

export function PredictionHistory({ dates }: { dates: PredictionsByDate[] }) {
  const [expanded, setExpanded] = useState(false)

  if (dates.length === 0) return null

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
            <span className="text-muted-foreground">{dates.length}일</span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {expanded && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            {dates.map(group => (
              <DateGroup key={group.date} group={group} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
