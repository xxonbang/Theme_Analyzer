import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronUp, BarChart3, History, X } from "lucide-react"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import type { MacroIndicatorsData } from "@/hooks/useMacroIndicators"
import type { IndicatorHistoryData } from "@/hooks/useIndicatorHistory"

interface MacroIndicatorsProps {
  data: MacroIndicatorsData
  history?: IndicatorHistoryData | null
  historyLoading?: boolean
  onRequestHistory?: () => void
}

const SUMMARY_SYMBOLS = ["NQ=F", "KOSPI200F", "069500", "EWY", "KORU", "^VIX", "FNG"]
const SHORT_NAMES: Record<string, string> = { "NQ=F": "NQ", "069500": "K200F", "^VIX": "VIX", "FNG": "F&G" }
const LINE_COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"]

const INDICATOR_DESC: Record<string, string> = {
  "NQ=F": "나스닥100 선물 (E-mini). 미국 기술주 100개 종목 선물지수. 한국 시장 개장 전 미국 시장 방향성을 가늠하는 핵심 지표.",
  "KOSPI200F": "코스피200 선물. 코스피200 지수를 기초자산으로 하는 파생상품. 기관/외국인 수급 방향을 선행적으로 반영.",
  "069500": "KODEX 200 ETF (코스피200 지수 추종). 코스피200 현물 지수의 실시간 대리 지표로 활용.",
  "EWY": "iShares MSCI South Korea ETF. 미국에 상장된 한국 대표 ETF. 외국인 투자자의 한국 시장 투자 심리를 반영.",
  "KORU": "Direxion Daily South Korea Bull 3X. 한국 시장 3배 레버리지 ETF. 외국인의 한국 시장 공격적 매수/매도 심리 반영.",
  "SOXX": "iShares Semiconductor ETF. 미국 반도체 섹터 ETF. 삼성전자·SK하이닉스 등 한국 반도체주와 높은 상관관계.",
  "^VIX": "CBOE 변동성지수 (공포지수). S&P500 옵션의 내재 변동성 측정. 20 이하 안정, 30 이상 공포 구간.",
  "FNG": "CNN Fear & Greed Index. 시장 심리를 0(극단적 공포)~100(극단적 탐욕) 수치로 표현. 25 이하 공포, 75 이상 탐욕.",
}

function MacroChart({ rows, dates }: { rows: { name: string; entries: { date: string; change_pct: number }[] }[]; dates: string[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  if (dates.length < 2 || rows.length === 0) return null

  const visibleRows = rows.filter(r => !hidden.has(r.name))

  const W = 320, H = 140, PL = 34, PR = 6, PT = 10, PB = 16
  const chartW = W - PL - PR, chartH = H - PT - PB

  // visible 종목 기준 min/max
  const allVals = visibleRows.flatMap(r => r.entries.map(e => e.change_pct))
  const rawMin = allVals.length ? Math.min(...allVals) : -1
  const rawMax = allVals.length ? Math.max(...allVals) : 1
  // 여백 5% 추가
  const pad = (rawMax - rawMin) * 0.05 || 0.1
  const min = rawMin - pad
  const max = rawMax + pad
  const range = max - min || 1

  const toY = (v: number) => PT + (1 - (v - min) / range) * chartH
  const toX = (i: number) => PL + (i / (dates.length - 1)) * chartW

  // Y축 라벨: 0선 + 상/하 경계 + 중간값
  const yLabelSet = new Set<number>()
  yLabelSet.add(rawMax)
  yLabelSet.add(rawMin)
  if (rawMin < 0 && rawMax > 0) yLabelSet.add(0)
  const mid = (rawMax + rawMin) / 2
  if (Math.abs(mid - rawMax) > (rawMax - rawMin) * 0.2) yLabelSet.add(mid)
  const yLabels = [...yLabelSet].sort((a, b) => b - a)

  const toggle = (name: string) => {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  return (
    <div className="mb-2">
      {/* 범례 토글 */}
      <div className="flex flex-wrap gap-1 px-1 mb-1">
        <button
          onClick={() => setHidden(prev => prev.size === 0 ? new Set(rows.map(r => r.name)) : new Set())}
          className="text-[9px] px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
        >
          {hidden.size === 0 ? "전체해제" : "전체선택"}
        </button>
        {rows.map((row, ri) => {
          const active = !hidden.has(row.name)
          const color = LINE_COLORS[ri % LINE_COLORS.length]
          return (
            <button
              key={row.name}
              onClick={() => toggle(row.name)}
              className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${active ? "font-semibold" : "opacity-30"}`}
              style={active ? { backgroundColor: color + "18", color } : undefined}
            >
              {row.name}
            </button>
          )
        })}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 160 }}>
        {/* Y축 가로 그리드선 + 라벨 */}
        {yLabels.map((v, i) => {
          const y = toY(v)
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="currentColor" strokeOpacity={v === 0 ? 0.18 : 0.08} strokeDasharray={v === 0 ? "none" : "3,3"} />
              <text x={PL - 3} y={y + 3} textAnchor="end" fill="currentColor" opacity={0.6} fontSize={9}>{v.toFixed(2)}%</text>
            </g>
          )
        })}
        {/* X축 세로 그리드선 + 라벨 */}
        {dates.map((d, idx) => {
          const x = toX(idx)
          const showLabel = dates.length <= 5 || idx === 0 || idx === dates.length - 1 || idx === Math.floor(dates.length / 2)
          return (
            <g key={idx}>
              <line x1={x} y1={PT} x2={x} y2={PT + chartH} stroke="currentColor" strokeOpacity={0.05} strokeDasharray="2,4" />
              {showLabel && (
                <text x={x} y={H - 2} textAnchor="middle" fill="currentColor" opacity={0.6} fontSize={9}>
                  {d.slice(5).replace("-", "/")}
                </text>
              )}
            </g>
          )
        })}
        {/* 각 종목 꺾은선 */}
        {visibleRows.map((row) => {
          const ri = rows.indexOf(row)
          const points = dates.map((d, i) => {
            const entry = row.entries.find(e => e.date === d)
            return entry ? { x: toX(i), y: toY(entry.change_pct) } : null
          }).filter(Boolean) as { x: number; y: number }[]
          if (points.length < 2) return null
          const polyline = points.map(p => `${p.x},${p.y}`).join(" ")
          const color = LINE_COLORS[ri % LINE_COLORS.length]
          return (
            <g key={row.name}>
              <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.3} strokeLinejoin="round" opacity={0.85} />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={1.8} fill={color} />
              ))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function MacroIndicators({ data, history, historyLoading, onRequestHistory }: MacroIndicatorsProps) {
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedIndicator, setSelectedIndicator] = useState<string | null>(null)
  const { handleRef, sheetRef } = useSwipeToDismiss(() => setShowHistory(false))

  // 스크롤 잠금
  useEffect(() => {
    if (!showHistory) return
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
  }, [showHistory])

  if (!data?.indicators?.length) return null

  const summaryItems = data.indicators.filter((i) => SUMMARY_SYMBOLS.includes(i.symbol))

  const handleHistoryClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!showHistory && onRequestHistory) onRequestHistory()
    setShowHistory(!showHistory)
  }

  // 히스토리 테이블 데이터: 최근 10일
  const historyRows = history?.macro
    ? data.indicators.map((item) => {
        const entries = (history.macro[item.symbol] || []).slice(-10)
        const shortName = SHORT_NAMES[item.symbol] || (item.symbol === "KOSPI200F" ? (item.name.includes("지수") ? "K200" : "K200F") : item.name)
        return { symbol: item.symbol, name: shortName, entries }
      })
    : []

  // 날짜 목록 (가장 긴 entries 기준)
  const dates = historyRows.length > 0
    ? historyRows.reduce((longest, row) => row.entries.length > longest.length ? row.entries : longest, [] as { date: string }[]).map(e => e.date)
    : []

  return (
    <div className="mb-3 sm:mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full cursor-pointer group text-left"
      >
        {/* 헤더 */}
        <div className="flex items-center px-1 py-1">
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <span className="text-xs font-semibold text-foreground/80 ml-1.5">거시지표</span>
          {data.updated_at && (
            <span className="text-[10px] text-muted-foreground/60 tabular-nums ml-1.5">{data.updated_at.slice(5, 10).replace("-", "/")} · {data.updated_at.slice(11, 16)}</span>
          )}
          {/* History 아이콘 */}
          <span
            role="button"
            onClick={handleHistoryClick}
            className="inline-flex items-center text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors ml-1.5"
          >
            <History className="w-3 h-3" />
          </span>
          <span className="ml-auto text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>

        {/* 접힌 상태: 4칸 그리드로 전체 너비 활용 */}
        {!expanded && (
          <div className="flex gap-px bg-border/30 rounded-md overflow-hidden mt-1">
            {summaryItems.map((item) => {
              const isUp = item.change_pct > 0
              const isDown = item.change_pct < 0
              const name = SHORT_NAMES[item.symbol] || (item.symbol === "KOSPI200F" ? (item.name.includes("지수") ? "K200" : "K200F") : item.name)
              const isFng = item.symbol === "FNG"
              const isVix = item.symbol === "^VIX"
              const bg = isFng
                ? (item.price >= 75 ? "bg-rose-100 dark:bg-rose-950" : item.price >= 50 ? "bg-orange-50 dark:bg-orange-950" : item.price >= 25 ? "bg-amber-50 dark:bg-amber-950" : "bg-sky-100 dark:bg-sky-950")
                : isVix
                  ? (isUp ? "bg-amber-50 dark:bg-amber-950" : isDown ? "bg-emerald-50 dark:bg-emerald-950" : "bg-muted/50")
                  : (isUp ? "bg-rose-100 dark:bg-rose-950" : isDown ? "bg-sky-100 dark:bg-sky-950" : "bg-muted/50")
              return (
                <div
                  key={item.symbol}
                  className={`flex-1 flex flex-col items-center py-1 ${bg}`}
                >
                  <span className="text-[9px] text-foreground/55 font-medium leading-none">{name}</span>
                  {isFng ? (
                    <span className={`text-[11px] tabular-nums font-bold leading-tight ${item.price >= 50 ? "text-red-500" : "text-blue-500"}`}>
                      {item.price.toFixed(0)}
                    </span>
                  ) : isVix ? (
                    <span className={`text-[11px] tabular-nums font-bold leading-tight ${isUp ? "text-amber-600" : isDown ? "text-emerald-600" : "text-muted-foreground/40"}`}>
                      {item.price.toFixed(1)}
                    </span>
                  ) : (
                    <span className={`text-[11px] tabular-nums font-bold leading-tight ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}>
                      {isUp ? "+" : ""}{item.change_pct.toFixed(1)}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </button>

      {/* 펼친 상태 */}
      {expanded && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-1.5 px-1">
          {data.indicators.map((item) => {
            const isUp = item.change_pct > 0
            const isDown = item.change_pct < 0
            const priceStr = item.source === "kis_futures"
              ? item.price.toFixed(2)
              : item.source === "kis_overseas" || item.source === "yfinance"
                ? item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : item.price.toLocaleString()
            const accent = isUp ? "border-l-red-500/60" : isDown ? "border-l-blue-500/60" : "border-l-border"

            return (
              <div
                key={item.symbol}
                onClick={() => setSelectedIndicator(item.symbol)}
                className={`rounded-md border border-border/50 border-l-2 ${accent} bg-card/60 backdrop-blur-sm px-2.5 py-2 flex flex-col gap-1 transition-colors hover:bg-card cursor-pointer`}
              >
                <span className="text-[10px] text-muted-foreground/60 font-medium truncate leading-none">
                  {item.name}
                </span>
                <span className="text-[13px] font-bold tabular-nums tracking-tight leading-none text-foreground">
                  {priceStr}
                </span>
                <span className={`text-[10px] font-medium tabular-nums leading-none ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}>
                  {isUp ? "+" : ""}{item.change_pct.toFixed(2)}%
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 지표 설명 팝업 */}
      {selectedIndicator && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setSelectedIndicator(null)}>
          <div className="absolute inset-0 bg-black/25" />
          <div className="relative mx-4 max-w-sm w-full bg-popover text-popover-foreground rounded-xl shadow-xl border border-border p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">
                {data.indicators.find(i => i.symbol === selectedIndicator)?.name || selectedIndicator}
              </span>
              <button onClick={() => setSelectedIndicator(null)} className="text-muted-foreground hover:text-foreground p-1 -m-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {INDICATOR_DESC[selectedIndicator] || "설명 없음"}
            </p>
          </div>
        </div>,
        document.body
      )}

      {/* 히스토리 Bottom Sheet */}
      {showHistory && createPortal(
        <div className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/25" onClick={() => setShowHistory(false)} />
          <div ref={sheetRef} className="relative w-full sm:w-96 sm:max-w-[90vw] max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
            <div ref={handleRef} className="sm:hidden flex justify-center mb-2 py-3 cursor-grab">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">거시지표 히스토리</span>
              <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground p-1 -m-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            {historyLoading ? (
              <p className="text-[10px] text-muted-foreground/50 text-center py-2">로딩 중...</p>
            ) : dates.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/50 text-center py-2">히스토리 없음</p>
            ) : (
              <>
              <MacroChart rows={historyRows} dates={dates} />
              <hr className="border-border/20 my-1.5" />
              <div className="overflow-x-auto -mx-3 px-3 sm:-mx-4 sm:px-4">
                <table className="w-full text-[11px] tabular-nums" style={{ minWidth: 420 }}>
                  <thead>
                    <tr className="text-foreground/80">
                      <th className="text-left py-1 pr-3 font-semibold sticky left-0 bg-popover z-[1]">날짜</th>
                      {historyRows.map((row) => (
                        <th key={row.symbol} className="text-right py-1 px-1.5 font-semibold whitespace-nowrap">{row.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...dates].reverse().map((date, di) => (
                      <tr key={date} className={`border-t border-border/20 ${di % 2 === 1 ? "bg-muted/30" : ""}`}>
                        <td className="py-1 pr-3 text-foreground/70 font-medium sticky left-0 bg-popover z-[1]">{date.slice(5).replace("-", "/")}</td>
                        {historyRows.map((row) => {
                          const entry = row.entries.find(e => e.date === date)
                          if (!entry) return <td key={row.symbol} className="text-right py-1 px-1.5 text-muted-foreground/30">—</td>
                          const isUp = entry.change_pct > 0
                          const isDown = entry.change_pct < 0
                          return (
                            <td
                              key={row.symbol}
                              className={`text-right py-1 px-1.5 font-medium whitespace-nowrap ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}
                            >
                              {isUp ? "+" : ""}{entry.change_pct.toFixed(1)}%
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
