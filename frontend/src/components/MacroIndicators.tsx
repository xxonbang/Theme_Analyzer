import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronUp, BarChart3, History, X, TrendingUp } from "lucide-react"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import type { MacroIndicatorsData, InvestorTrendDay, FuturesItem } from "@/hooks/useMacroIndicators"
import type { IndicatorHistoryData } from "@/hooks/useIndicatorHistory"

interface MacroIndicatorsProps {
  data: MacroIndicatorsData
  history?: IndicatorHistoryData | null
  historyLoading?: boolean
  onRequestHistory?: () => void
}

const SUMMARY_SYMBOLS = ["NQ=F", "KOSPI200", "EWY", "KORU", "^VIX", "FNG"]
const SHORT_NAMES: Record<string, string> = { "NQ=F": "NQ", "KOSPI200": "K200", "^VIX": "VIX", "FNG": "F&G" }
const LINE_COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"]

const INDICATOR_DESC: Record<string, string> = {
  "NQ=F": "나스닥100 선물 (E-mini). 미국 기술주 100개 종목 선물지수. 한국 시장 개장 전 미국 시장 방향성을 가늠하는 핵심 지표.",
  "KOSPI200": "코스피200 지수. 한국거래소 대표 대형주 200종목으로 구성된 시가총액 가중 지수. 한국 시장 전반의 방향성을 나타내는 핵심 벤치마크.",
  "EWY": "iShares MSCI South Korea ETF. 미국에 상장된 한국 대표 ETF. 외국인 투자자의 한국 시장 투자 심리를 반영.",
  "KORU": "Direxion Daily South Korea Bull 3X. 한국 시장 3배 레버리지 ETF. 외국인의 한국 시장 공격적 매수/매도 심리 반영.",
  "SOXX": "iShares Semiconductor ETF. 미국 반도체 섹터 ETF. 삼성전자·SK하이닉스 등 한국 반도체주와 높은 상관관계.",
  "^VIX": "CBOE 변동성지수 (공포지수). S&P500 옵션의 내재 변동성 측정. 20 이하 안정, 30 이상 공포 구간.",
  "FNG": "CNN Fear & Greed Index. 시장 심리를 0(극단적 공포)~100(극단적 탐욕) 수치로 표현. 25 이하 공포, 75 이상 탐욕.",
}

const FUTURES_SHORT: Record<string, string> = { "K200F_DAY": "K200주", "K200F_NGT": "K200야", "SPX_F": "S&P", "NQ_F": "NQ", "OIL_F": "원유", "GOLD_F": "금" }

function FuturesBar({ data, updatedAt, history, historyLoading, onRequestHistory }: { data: FuturesItem[]; updatedAt?: string; history?: IndicatorHistoryData | null; historyLoading?: boolean; onRequestHistory?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [chartHidden, setChartHidden] = useState<Set<string>>(new Set())
  const { handleRef, sheetRef } = useSwipeToDismiss(() => setShowHistory(false), 80, showHistory)

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

  if (!data || data.length === 0) return null

  const handleHistoryClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!showHistory && onRequestHistory) onRequestHistory()
    setShowHistory(!showHistory)
  }

  // 히스토리 차트 데이터 준비
  const futHist = history?.futures
  const histRows = futHist ? data.map(item => {
    const entries = (futHist[item.symbol] || []).slice(-10)
    return { symbol: item.symbol, name: FUTURES_SHORT[item.symbol] || item.name, entries }
  }) : []
  const histDates = histRows.length > 0
    ? histRows.reduce((longest, row) => row.entries.length > longest.length ? row.entries : longest, [] as { date: string }[]).map(e => e.date)
    : []

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full cursor-pointer group text-left"
      >
        <div className="flex items-center px-1 py-1">
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <span className="text-xs font-semibold text-foreground/80 ml-1.5">주요 선물</span>
          {updatedAt && (
            <span className="text-[10px] text-muted-foreground/60 tabular-nums ml-1.5">{updatedAt.slice(5, 10).replace("-", "/")} · {updatedAt.slice(11, 16)}</span>
          )}
          <span
            role="button"
            onClick={handleHistoryClick}
            className="inline-flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground/60 hover:text-primary bg-muted/60 hover:bg-primary/10 rounded px-1.5 py-0.5 transition-colors ml-1.5"
          >
            <History className="w-3 h-3" />
            히스토리
          </span>
          <span className="ml-auto text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>

        {/* 접힌 상태: 6칸 그리드 */}
        {!expanded && (
          <div className="flex gap-px bg-border/30 rounded-md overflow-hidden mt-1">
            {data.map((item) => {
              const isUp = item.change > 0
              const isDown = item.change < 0
              const bg = isUp ? "bg-rose-100 dark:bg-red-500/8" : isDown ? "bg-sky-100 dark:bg-blue-500/8" : "bg-muted/50"
              // 짧은 라벨
              const shortName: Record<string, string> = {
                "K200F_DAY": "K200주",
                "K200F_NGT": "K200야",
                "SPX_F": "S&P",
                "NQ_F": "NQ",
                "OIL_F": "원유",
                "GOLD_F": "금",
              }
              return (
                <div key={item.symbol} className={`flex-1 flex flex-col items-center py-1 ${bg}`}>
                  <span className="text-[9px] text-foreground/65 font-medium leading-none">{shortName[item.symbol] || item.name}</span>
                  <span className={`text-[11px] tabular-nums font-bold leading-tight ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}>
                    {isUp ? "+" : ""}{item.change_pct.toFixed(1)}%
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </button>

      {/* 펼친 상태 */}
      {expanded && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-0.5 px-1">
          {data.map((item) => {
            const isUp = item.change > 0
            const isDown = item.change < 0
            const accent = isUp ? "border-l-red-500/60" : isDown ? "border-l-blue-500/60" : "border-l-border"
            const priceStr = item.price >= 10000
              ? item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : item.price.toFixed(2)
            return (
              <div key={item.symbol} className={`rounded-md border border-border/50 border-l-2 ${accent} bg-card/60 backdrop-blur-sm px-2.5 py-2 flex flex-col gap-1`}>
                <span className="text-[10px] text-muted-foreground/60 font-medium truncate leading-none">{item.name}</span>
                <span className="text-[13px] font-bold tabular-nums tracking-tight leading-none text-foreground">{priceStr}</span>
                <span className={`text-[10px] font-medium tabular-nums leading-none ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}>
                  {isUp ? "+" : ""}{item.change_pct.toFixed(2)}%
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 선물 히스토리 Bottom Sheet */}
      {showHistory && createPortal(
        <div className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/25" onClick={() => setShowHistory(false)} />
          <div ref={sheetRef} className="relative w-full sm:w-[28rem] sm:max-w-[90vw] max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
            <div ref={handleRef} className="sm:hidden flex items-center justify-center mb-2 py-3 cursor-grab relative">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              <button onClick={() => setShowHistory(false)} className="absolute right-0 text-muted-foreground hover:text-foreground p-1" aria-label="닫기">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">주요 선물 히스토리</span>
              <button onClick={() => setShowHistory(false)} className="hidden sm:block text-muted-foreground hover:text-foreground p-1 -m-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            {historyLoading ? (
              <p className="text-[10px] text-muted-foreground/50 text-center py-2">로딩 중...</p>
            ) : histDates.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/50 text-center py-2">히스토리 없음 (다음 수집 시 축적됩니다)</p>
            ) : (
              <>
              <MacroChart rows={histRows} dates={histDates} hidden={chartHidden} setHidden={setChartHidden} />
              <hr className="border-border/30 my-3" />
              <table className="w-full text-[10px] tabular-nums">
                <thead>
                  <tr className="text-foreground/80 border-b border-border/30">
                    <th className="text-left py-1.5 pr-2 font-semibold">날짜</th>
                    {histRows.map((row) => {
                      const active = chartHidden.size > 0 && !chartHidden.has(row.name)
                      return (
                        <th key={row.symbol} className={`text-right py-1.5 px-0.5 font-semibold ${active ? "bg-primary/8" : chartHidden.size > 0 ? "opacity-30" : ""}`}>{row.name}</th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {histDates.map((date, di) => (
                    <tr key={date} className={`border-t border-border/15 ${di % 2 === 1 ? "bg-muted/30" : ""}`}>
                      <td className="py-2 pr-2 text-foreground/70 font-medium">{date.slice(5).replace("-", "/")}</td>
                      {histRows.map((row) => {
                        const active = chartHidden.size > 0 && !chartHidden.has(row.name)
                        const dimmed = chartHidden.size > 0 && chartHidden.has(row.name)
                        const entry = row.entries.find(e => e.date === date)
                        if (!entry) return <td key={row.symbol} className={`text-right py-2 px-0.5 text-muted-foreground/30 ${active ? "bg-primary/8" : ""}`}>—</td>
                        const isUp = entry.change_pct > 0
                        const isDown = entry.change_pct < 0
                        return (
                          <td key={row.symbol} className={`text-right py-2 px-0.5 font-semibold ${active ? "bg-primary/8" : ""} ${dimmed ? "opacity-30" : ""} ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}>
                            {isUp ? "+" : ""}{entry.change_pct.toFixed(1)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function formatAmount(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 10_000_000) return (v / 10_000_000).toFixed(1) + "조"
  if (abs >= 1_000) return (v / 10_000).toFixed(1) + "억"
  return v.toFixed(0) + "백만"
}

function InvestorTrendBar({ data, updatedAt, history, historyLoading, onRequestHistory }: { data: InvestorTrendDay[]; updatedAt?: string; history?: IndicatorHistoryData | null; historyLoading?: boolean; onRequestHistory?: () => void }) {
  const [showDetail, setShowDetail] = useState(false)
  const [activeMarket, setActiveMarket] = useState<"kospi" | "kosdaq">("kospi")
  const [investorHidden, setInvestorHidden] = useState<Set<string>>(new Set())
  const { handleRef, sheetRef } = useSwipeToDismiss(() => setShowDetail(false), 80, showDetail)

  useEffect(() => {
    if (!showDetail) return
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
  }, [showDetail])

  if (!data || data.length === 0) return null

  const latest = data[data.length - 1]

  const renderCell = (val: number) => {
    const isUp = val > 0
    const isDown = val < 0
    return (
      <span className={`font-semibold ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}>
        {isUp ? "+" : ""}{formatAmount(val)}
      </span>
    )
  }

  return (
    <>
      <div className="mt-1.5">
        <div className="flex items-center px-1 py-1.5 mb-1">
          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <span className="text-xs font-semibold text-foreground/80 ml-1.5">투자자 수급</span>
          <span className="text-[10px] text-muted-foreground/60 tabular-nums ml-1.5">
            {latest.date.slice(5).replace("-", "/")}
            {updatedAt && <span> · {updatedAt.slice(11, 16)}</span>}
          </span>
          <button
            onClick={() => { if (onRequestHistory) onRequestHistory(); setShowDetail(true) }}
            className="inline-flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground/60 hover:text-primary bg-muted/60 hover:bg-primary/10 rounded px-1.5 py-0.5 transition-colors ml-1.5"
          >
            <History className="w-3 h-3" />
            히스토리
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(["kospi", "kosdaq"] as const).map((market) => {
            const d = latest[market]
            return (
              <div key={market} className="bg-muted/40 rounded-lg px-2 py-1.5 border border-border/40">
                <span className="text-[11px] font-bold text-foreground block mb-1">{market === "kospi" ? "코스피" : "코스닥"}</span>
                <div className="grid grid-cols-3 gap-1">
                  {([
                    { label: "외국인", key: "foreign" as const },
                    { label: "기관", key: "institution" as const },
                    { label: "개인", key: "individual" as const },
                  ]).map(({ label, key }) => (
                    <div key={key} className="text-center min-w-0">
                      <span className="text-[9px] text-muted-foreground block leading-none mb-0.5">{label}</span>
                      <span className={`text-[11px] tabular-nums font-bold leading-none whitespace-nowrap ${d[key] > 0 ? "text-red-500" : d[key] < 0 ? "text-blue-500" : "text-muted-foreground"}`}>
                        {d[key] > 0 ? "+" : ""}{formatAmount(d[key])}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showDetail && createPortal(
        <div className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/25" onClick={() => setShowDetail(false)} />
          <div ref={sheetRef} className="relative w-full sm:w-[28rem] sm:max-w-[90vw] max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
            <div ref={handleRef} className="sm:hidden flex items-center justify-center mb-2 py-3 cursor-grab relative">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              <button onClick={() => setShowDetail(false)} className="absolute right-0 text-muted-foreground hover:text-foreground p-1" aria-label="닫기">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">투자자 수급 동향</span>
              <button onClick={() => setShowDetail(false)} className="hidden sm:block text-muted-foreground hover:text-foreground p-1 -m-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            {(() => {
              const invHist = history?.investor_trend || []
              const merged = [...invHist]
              const existingDates = new Set(merged.map(d => d.date))
              for (const d of data) {
                if (!existingDates.has(d.date)) merged.push(d as typeof merged[0])
              }
              merged.sort((a, b) => b.date.localeCompare(a.date))
              const displayDays = merged.slice(0, 20)
              const chartDays = [...displayDays].reverse()
              const chartDates = chartDays.map(d => d.date)
              const market = activeMarket
              const investorRows = [
                { name: "외국인", entries: chartDays.map(d => ({ date: d.date, change_pct: d[market].foreign / 100 })) },
                { name: "기관", entries: chartDays.map(d => ({ date: d.date, change_pct: d[market].institution / 100 })) },
                { name: "개인", entries: chartDays.map(d => ({ date: d.date, change_pct: d[market].individual / 100 })) },
              ]
              return (
                <>
                  <div className="flex items-center gap-1 mb-2">
                    {(["kospi", "kosdaq"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setActiveMarket(m)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${activeMarket === m ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
                      >
                        {m === "kospi" ? "코스피" : "코스닥"}
                      </button>
                    ))}
                    <div className="flex gap-1 ml-auto">
                      {investorRows.map((row, ri) => {
                        const active = !investorHidden.has(row.name)
                        const color = INVESTOR_COLORS[ri]
                        return (
                          <button
                            key={row.name}
                            onClick={() => setInvestorHidden(prev => { const next = new Set(prev); if (next.has(row.name)) next.delete(row.name); else next.add(row.name); return next })}
                            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition-colors ${active ? "" : "opacity-30"}`}
                            style={active ? { backgroundColor: color + "18", color } : undefined}
                          >
                            {row.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {chartDates.length >= 2 && (
                    <>
                      <InvestorChart rows={investorRows} dates={chartDates} hidden={investorHidden} />
                      <hr className="border-border/30 my-2" />
                    </>
                  )}
                  <table className="w-full text-[10px] tabular-nums">
                    <thead>
                      <tr className="text-foreground/80 border-b border-border/30">
                        <th className="text-left py-1.5 pr-1 font-semibold">날짜</th>
                        <th className="text-right py-1.5 px-1 font-semibold">지수</th>
                        <th className="text-right py-1.5 px-1 font-semibold">외국인</th>
                        <th className="text-right py-1.5 px-1 font-semibold">기관</th>
                        <th className="text-right py-1.5 px-1 font-semibold">개인</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayDays.map((day, di) => {
                        const d = day[market]
                        return (
                          <tr key={day.date} className={`border-t border-border/15 ${di % 2 === 1 ? "bg-muted/30" : ""}`}>
                            <td className="py-1.5 pr-1 text-foreground/70 font-medium">{day.date.slice(5).replace("-", "/")}</td>
                            <td className={`text-right py-1.5 px-1 ${d.change_pct > 0 ? "text-red-500" : d.change_pct < 0 ? "text-blue-500" : "text-muted-foreground/40"}`}>
                              {d.change_pct > 0 ? "+" : ""}{d.change_pct.toFixed(2)}%
                            </td>
                            <td className="text-right py-1.5 px-1">{renderCell(d.foreign)}</td>
                            <td className="text-right py-1.5 px-1">{renderCell(d.institution)}</td>
                            <td className="text-right py-1.5 px-1">{renderCell(d.individual)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </>
              )
            })()}
            {historyLoading && <p className="text-[10px] text-muted-foreground/50 text-center py-1">히스토리 로딩 중...</p>}
            <p className="text-[9px] text-muted-foreground/50 mt-1">단위: 백만원 (1조 = 10,000억)</p>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

const INVESTOR_COLORS = ["#ef4444", "#3b82f6", "#10b981"] // 외국인(빨강), 기관(파랑), 개인(초록)

function InvestorChart({ rows, dates, hidden }: { rows: { name: string; entries: { date: string; change_pct: number }[] }[]; dates: string[]; hidden: Set<string> }) {
  if (dates.length < 2 || rows.length === 0) return null

  const visibleRows = rows.filter(r => !hidden.has(r.name))

  const W = 360, H = 150, PL = 48, PR = 36, PT = 12, PB = 18
  const chartW = W - PL - PR, chartH = H - PT - PB

  const allVals = visibleRows.flatMap(r => r.entries.map(e => e.change_pct))
  if (allVals.length === 0) return null
  const rawMin = Math.min(...allVals)
  const rawMax = Math.max(...allVals)
  const pad = (rawMax - rawMin) * 0.15 || 0.5
  const min = rawMin - pad
  const max = rawMax + pad
  const range = max - min || 1

  const toY = (v: number) => PT + (1 - (Math.max(min, Math.min(max, v)) - min) / range) * chartH
  const toX = (i: number) => PL + (i / (dates.length - 1)) * chartW

  const ySteps = 3
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => rawMin + (rawMax - rawMin) * (i / ySteps))
  if (rawMin < 0 && rawMax > 0 && !yLabels.some(v => Math.abs(v) < 0.01)) yLabels.push(0)

  const fmtY = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 100000) return (v / 10000).toFixed(0) + "조"
    if (abs >= 100) return (v / 100).toFixed(0) + "억"
    return v.toFixed(0) + "백만"
  }

  return (
    <div className="mb-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 170 }}>
        {yLabels.map((v, i) => {
          const y = toY(v)
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="currentColor" strokeOpacity={Math.abs(v) < 0.01 ? 0.2 : 0.08} strokeDasharray={Math.abs(v) < 0.01 ? "none" : "3,3"} />
              <text x={PL - 4} y={y + 3.5} textAnchor="end" fill="#555" fontWeight={600} fontSize={8}>{fmtY(v)}</text>
            </g>
          )
        })}
        {dates.map((d, idx) => {
          const x = toX(idx)
          const showLabel = dates.length <= 5 || idx === 0 || idx === dates.length - 1 || idx === Math.floor(dates.length / 2)
          return (
            <g key={idx}>
              <line x1={x} y1={PT} x2={x} y2={PT + chartH} stroke="currentColor" strokeOpacity={0.05} strokeDasharray="2,4" />
              {showLabel && <text x={x} y={H - 2} textAnchor="middle" fill="#555" fontWeight={600} fontSize={9}>{d.slice(5).replace("-", "/")}</text>}
            </g>
          )
        })}
        {visibleRows.map((row) => {
          const ri = rows.indexOf(row)
          const points = dates.map((d, i) => {
            const entry = row.entries.find(e => e.date === d)
            return entry ? { x: toX(i), y: toY(entry.change_pct) } : null
          }).filter(Boolean) as { x: number; y: number }[]
          if (points.length < 2) return null
          const color = INVESTOR_COLORS[ri]
          return (
            <g key={row.name}>
              <polyline points={points.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" opacity={0.85} />
              {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.2} fill={color} />)}
              {(() => { const last = points[points.length - 1]; return last ? <text x={last.x + 4} y={last.y + 3} fill={color} fontSize={8} fontWeight={700}>{row.name}</text> : null })()}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function MacroChart({ rows, dates, hidden, setHidden }: { rows: { name: string; entries: { date: string; change_pct: number }[] }[]; dates: string[]; hidden: Set<string>; setHidden: React.Dispatch<React.SetStateAction<Set<string>>> }) {

  if (dates.length < 2 || rows.length === 0) return null

  const visibleRows = rows.filter(r => !hidden.has(r.name))

  const W = 360, H = 170, PL = 48, PR = 36, PT = 12, PB = 18
  const chartW = W - PL - PR, chartH = H - PT - PB

  // visible 종목 기준 min/max — IQR 기반 이상치 제거
  const allVals = visibleRows.flatMap(r => r.entries.map(e => e.change_pct))
  const sorted = [...allVals].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? -1
  const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 1
  const iqr = q3 - q1 || 1
  const lowerFence = q1 - iqr * 1.5
  const upperFence = q3 + iqr * 1.5
  // 이상치 제외한 min/max
  const inliers = allVals.filter(v => v >= lowerFence && v <= upperFence)
  const rawMin = inliers.length ? Math.min(...inliers) : (allVals.length ? Math.min(...allVals) : -1)
  const rawMax = inliers.length ? Math.max(...inliers) : (allVals.length ? Math.max(...allVals) : 1)
  // 여백 15% 추가
  const pad = (rawMax - rawMin) * 0.15 || 0.5
  const min = rawMin - pad
  const max = rawMax + pad
  const range = max - min || 1

  // 이상치는 차트 경계에 클램핑
  const toY = (v: number) => {
    const clamped = Math.max(min, Math.min(max, v))
    return PT + (1 - (clamped - min) / range) * chartH
  }
  const toX = (i: number) => PL + (i / (dates.length - 1)) * chartW

  // Y축 라벨: 균등 5분할
  const ySteps = 4
  const yLabelsRaw = Array.from({ length: ySteps + 1 }, (_, i) => rawMin + (rawMax - rawMin) * (i / ySteps))
  // 0선 추가 (rawMin < 0 && rawMax > 0)
  if (rawMin < 0 && rawMax > 0 && !yLabelsRaw.some(v => Math.abs(v) < 0.01)) {
    yLabelsRaw.push(0)
  }
  // 너무 가까운 라벨 제거 (chartH 기준 10px 미만 간격)
  const minGapPx = 10
  const yLabelsSorted = yLabelsRaw.sort((a, b) => b - a)
  const yLabels: number[] = []
  for (const v of yLabelsSorted) {
    const y = toY(v)
    if (yLabels.every(prev => Math.abs(toY(prev) - y) >= minGapPx)) {
      yLabels.push(v)
    }
  }

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
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
        {/* Y축 가로 그리드선 + 라벨 */}
        {yLabels.map((v, i) => {
          const y = toY(v)
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="currentColor" strokeOpacity={Math.abs(v) < 0.01 ? 0.2 : 0.08} strokeDasharray={Math.abs(v) < 0.01 ? "none" : "3,3"} />
              <text x={PL - 4} y={y + 3.5} textAnchor="end" fill="#555" fontWeight={600} fontSize={9}>{v.toFixed(1)}%</text>
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
                <text x={x} y={H - 2} textAnchor="middle" fill="#555" fontWeight={600} fontSize={9}>
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
              <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" opacity={0.85} />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={2.2} fill={color} />
              ))}
              {/* 선 끝 종목명 라벨 */}
              {(() => {
                const last = points[points.length - 1]
                if (!last) return null
                return (
                  <text x={last.x + 4} y={last.y + 3} fill={color} fontSize={8} fontWeight={700}>{row.name}</text>
                )
              })()}
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
  const [chartHidden, setChartHidden] = useState<Set<string>>(new Set())
  const { handleRef, sheetRef } = useSwipeToDismiss(() => setShowHistory(false), 80, showHistory)

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
        const shortName = SHORT_NAMES[item.symbol] || item.name
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
          {/* History 버튼 */}
          <span
            role="button"
            onClick={handleHistoryClick}
            className="inline-flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground/60 hover:text-primary bg-muted/60 hover:bg-primary/10 rounded px-1.5 py-0.5 transition-colors ml-1.5"
          >
            <History className="w-3 h-3" />
            히스토리
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
              const name = SHORT_NAMES[item.symbol] || item.name
              const isFng = item.symbol === "FNG"
              const isVix = item.symbol === "^VIX"
              const bg = isFng
                ? (item.price >= 75 ? "bg-rose-100 dark:bg-red-500/8" : item.price >= 50 ? "bg-orange-50 dark:bg-orange-500/8" : item.price >= 25 ? "bg-amber-50 dark:bg-amber-500/8" : "bg-sky-100 dark:bg-blue-500/8")
                : isVix
                  ? (isUp ? "bg-amber-50 dark:bg-amber-500/8" : isDown ? "bg-emerald-50 dark:bg-emerald-500/8" : "bg-muted/50")
                  : (isUp ? "bg-rose-100 dark:bg-red-500/8" : isDown ? "bg-sky-100 dark:bg-blue-500/8" : "bg-muted/50")
              return (
                <div
                  key={item.symbol}
                  className={`flex-1 flex flex-col items-center py-1 ${bg}`}
                >
                  <span className="text-[9px] text-foreground/65 font-medium leading-none">{name}</span>
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

      {/* 주요 선물 */}
      {data.futures && data.futures.length > 0 && (
        <FuturesBar data={data.futures} updatedAt={data.updated_at} history={history} historyLoading={historyLoading} onRequestHistory={onRequestHistory} />
      )}

      {/* 투자자 수급 */}
      {data.investor_trend && data.investor_trend.length > 0 && (
        <InvestorTrendBar data={data.investor_trend} updatedAt={data.updated_at} history={history} historyLoading={historyLoading} onRequestHistory={onRequestHistory} />
      )}

      {/* 히스토리 Bottom Sheet */}
      {showHistory && createPortal(
        <div className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/25" onClick={() => setShowHistory(false)} />
          <div ref={sheetRef} className="relative w-full sm:w-96 sm:max-w-[90vw] max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
            <div ref={handleRef} className="sm:hidden flex items-center justify-center mb-2 py-3 cursor-grab relative">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              <button onClick={() => setShowHistory(false)} className="absolute right-0 text-muted-foreground hover:text-foreground p-1" aria-label="닫기">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">거시지표 히스토리</span>
              <button onClick={() => setShowHistory(false)} className="hidden sm:block text-muted-foreground hover:text-foreground p-1 -m-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            {historyLoading ? (
              <p className="text-[10px] text-muted-foreground/50 text-center py-2">로딩 중...</p>
            ) : dates.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/50 text-center py-2">히스토리 없음</p>
            ) : (
              <>
              <MacroChart rows={historyRows} dates={dates} hidden={chartHidden} setHidden={setChartHidden} />
              <hr className="border-border/30 my-3" />
              <table className="w-full text-[10px] tabular-nums">
                <thead>
                  <tr className="text-foreground/80 border-b border-border/30">
                    <th className="text-left py-1.5 pr-2 font-semibold">날짜</th>
                    {historyRows.map((row) => {
                      const active = chartHidden.size > 0 && !chartHidden.has(row.name)
                      return (
                        <th key={row.symbol} className={`text-right py-1.5 px-0.5 font-semibold ${active ? "bg-primary/8" : chartHidden.size > 0 ? "opacity-30" : ""}`}>{row.name}</th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {dates.map((date, di) => (
                    <tr key={date} className={`border-t border-border/15 ${di % 2 === 1 ? "bg-muted/30" : ""}`}>
                      <td className="py-2 pr-2 text-foreground/70 font-medium">{date.slice(5).replace("-", "/")}</td>
                      {historyRows.map((row) => {
                        const active = chartHidden.size > 0 && !chartHidden.has(row.name)
                        const dimmed = chartHidden.size > 0 && chartHidden.has(row.name)
                        const entry = row.entries.find(e => e.date === date)
                        if (!entry) return <td key={row.symbol} className={`text-right py-2 px-0.5 text-muted-foreground/30 ${active ? "bg-primary/8" : ""}`}>—</td>
                        const isUp = entry.change_pct > 0
                        const isDown = entry.change_pct < 0
                        return (
                          <td
                            key={row.symbol}
                            className={`text-right py-2 px-0.5 font-semibold ${active ? "bg-primary/8" : ""} ${dimmed ? "opacity-30" : ""} ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}
                          >
                            {isUp ? "+" : ""}{entry.change_pct.toFixed(1)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
