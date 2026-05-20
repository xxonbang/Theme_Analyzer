import { useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronUp, BarChart3, History, X, TrendingUp } from "lucide-react"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { useScrollLock } from "@/hooks/useScrollLock"
import type { MacroIndicatorsData, InvestorTrendDay, FuturesItem } from "@/hooks/useMacroIndicators"
import type { IndicatorHistoryData } from "@/hooks/useIndicatorHistory"

interface IndexInfo {
  current: number
  ma5?: number
  ma10?: number
  ma20?: number
  status?: string
}

interface MacroIndicatorsProps {
  data: MacroIndicatorsData
  history?: IndicatorHistoryData | null
  historyLoading?: boolean
  onRequestHistory?: () => void
  kospiIndex?: IndexInfo
  kosdaqIndex?: IndexInfo
  investorTrend?: { kospi?: { change_pct?: number }; kosdaq?: { change_pct?: number } }[]
}

const SHORT_NAMES: Record<string, string> = { "NQ=F": "NQ", "KOSPI200": "K200", "^VIX": "VIX", "FNG": "F&G", "^GSPC": "S&P", "^IXIC": "NAS", "^DJI": "DOW", "^STOXX50E": "EU50", "000001.SS": "상하이", "^N225": "日経", "^KS11": "코스피", "^KQ11": "코스닥", "KOSPI": "코스피", "KOSDAQ": "코스닥", "069500": "KDX2", "MU": "MU" }
const LINE_COLORS = [
  "var(--color-chart-red)", "var(--color-chart-blue)", "var(--color-chart-amber)",
  "var(--color-chart-green)", "var(--color-chart-violet)", "var(--color-chart-pink)",
  "var(--color-chart-teal)", "var(--color-chart-orange)",
]

const INDICATOR_DESC: Record<string, string> = {
  "NQ=F": "나스닥100 선물 (E-mini). 미국 기술주 100개 종목 선물지수. 한국 시장 개장 전 미국 시장 방향성을 가늠하는 핵심 지표.",
  "KOSPI200": "코스피200 지수. 한국거래소 대표 대형주 200종목으로 구성된 시가총액 가중 지수. 한국 시장 전반의 방향성을 나타내는 핵심 벤치마크.",
  "EWY": "iShares MSCI South Korea ETF. 미국에 상장된 한국 대표 ETF. 외국인 투자자의 한국 시장 투자 심리를 반영.",
  "KORU": "Direxion Daily South Korea Bull 3X. 한국 시장 3배 레버리지 ETF. 외국인의 한국 시장 공격적 매수/매도 심리 반영.",
  "069500": "KODEX 200 ETF. 코스피200 지수를 추종하는 국내 최대 규모 상장지수펀드. 기관·외국인의 대표적 지수 추종 매매 수단.",
  "SOXX": "iShares Semiconductor ETF. 미국 반도체 섹터 ETF. 삼성전자·SK하이닉스 등 한국 반도체주와 높은 상관관계.",
  "^VIX": "CBOE 변동성지수 (공포지수). S&P500 옵션의 내재 변동성 측정. 20 이하 안정, 30 이상 공포 구간.",
  "FNG": "CNN Fear & Greed Index. 시장 심리를 0(극단적 공포)~100(극단적 탐욕) 수치로 표현. 25 이하 공포, 75 이상 탐욕.",
  "KOSPI": "코스피 종합지수. 한국거래소 유가증권시장 전 종목 시가총액 가중 지수. 한국 주식시장의 대표 벤치마크.",
  "KOSDAQ": "코스닥 종합지수. 코스닥시장 전 종목 시가총액 가중 지수. 중소·벤처·기술주 중심의 성장 시장.",
  "^KS11": "코스피 종합지수. 한국거래소 유가증권시장 전 종목 시가총액 가중 지수. 한국 주식시장의 대표 벤치마크.",
  "^KQ11": "코스닥 종합지수. 코스닥시장 전 종목 시가총액 가중 지수. 중소·벤처·기술주 중심의 성장 시장.",
  "^DJI": "다우존스 산업평균지수. 미국 대표 30개 대형 우량주로 구성. 전통 산업·금융주 비중이 높아 미국 경제 전반의 체감 지표.",
  "^GSPC": "S&P500 지수. 미국 500대 기업 시가총액 가중 지수. 글로벌 투자의 최대 벤치마크.",
  "^IXIC": "나스닥 종합지수. 나스닥 상장 전 종목 포함. 기술·성장주 비중이 높아 혁신 섹터 방향성 반영.",
  "^STOXX50E": "유로스톡스50 지수. 유로존 12개국 대표 50개 대형주. 유럽 경제 방향성 반영.",
  "000001.SS": "상하이종합지수. 중국 상하이증권거래소 전 종목. 중국 경기·정책 민감도 반영.",
  "^N225": "닛케이225 지수. 일본 대표 225개 기업. 엔화 약세·강세에 민감, 아시아 시장 선행 지표.",
  "MU": "마이크론 테크놀로지(Micron Technology). 세계 3대 메모리 반도체 기업. DRAM·NAND 가격 사이클의 선행 지표로, 삼성전자·SK하이닉스 실적과 직결.",
  "K200F_DAY": "코스피200 주간선물. 정규장(09:00~15:45) 거래. 기관·외국인의 당일 시장 방향 베팅을 실시간 반영.",
  "K200F_NGT": "코스피200 야간선물. 야간장(18:00~05:00) 거래. 미국 시장 변동을 반영하여 다음 날 한국 시장 갭 방향을 예측하는 데 활용.",
  "SPX_F": "S&P500 E-mini 선물. 미국 대형주 500종목 지수 선물. 글로벌 위험자산 선호도를 가장 직접적으로 반영하는 선물 상품.",
  "OIL_F": "WTI 원유 선물. 미국 서부텍사스산 중질유 기준. 인플레이션·운송비·정유주에 직접 영향. 지정학적 리스크의 바로미터.",
  "GOLD_F": "금 선물. 대표적 안전자산. 금리 인하 기대·달러 약세·지정학 불안 시 상승. 시장 위험 회피 심리 반영.",
}

const FUTURES_SHORT: Record<string, string> = { "K200F_DAY": "K200주", "K200F_NGT": "K200야", "SPX_F": "S&P", "OIL_F": "원유", "GOLD_F": "금" }
const TODAY_KST = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()

function FuturesBar({ data, updatedAt, history, historyLoading, onRequestHistory, extraFutures }: { data: FuturesItem[]; updatedAt?: string; history?: IndicatorHistoryData | null; historyLoading?: boolean; onRequestHistory?: () => void; extraFutures?: FuturesItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [chartHidden, setChartHidden] = useState<Set<string>>(new Set())
  const { handleRef, sheetRef } = useSwipeToDismiss(() => setShowHistory(false), 80, showHistory)
  useScrollLock(showHistory)

  const filtered = [...(extraFutures || []), ...data.filter(item => item.symbol !== "NQ_F")]
  if (!filtered || filtered.length === 0) return null

  const handleHistoryClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!showHistory && onRequestHistory) onRequestHistory()
    setShowHistory(!showHistory)
  }

  // 히스토리 차트 데이터 준비
  const futHist = history?.futures
  const histRows = futHist ? filtered.map(item => {
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
            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground/60 hover:text-primary bg-muted/60 hover:bg-primary/10 rounded px-1.5 py-0.5 transition-colors ml-1.5"
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
            {filtered.map((item) => {
              const isUp = item.change > 0
              const isDown = item.change < 0
              const bg = isUp ? "bg-rose-100 dark:bg-red-500/8" : isDown ? "bg-sky-100 dark:bg-blue-500/8" : "bg-muted/50"
              // 짧은 라벨
              const shortName: Record<string, string> = {
                "NQ=F": "NQ",
                "K200F_DAY": "K200주",
                "K200F_NGT": "K200야",
                "SPX_F": "S&P",
                "OIL_F": "원유",
                "GOLD_F": "금",
              }
              return (
                <div key={item.symbol} className={`flex-1 flex flex-col items-center py-1 ${bg}`}>
                  <span className="text-[10px] text-foreground/65 font-medium leading-none">{shortName[item.symbol] || item.name}</span>
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
        <div className="grid grid-cols-2 gap-1.5 mt-1 px-1">
          {filtered.map((item) => {
            const isUp = item.change > 0
            const isDown = item.change < 0
            const prev = item.price - item.change
            const priceStr = item.price >= 10000
              ? item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : item.price.toFixed(2)
            return (
              <div
                key={item.symbol}
                className={`relative rounded-lg px-3 py-2 overflow-hidden transition-all duration-200 hover:scale-[1.01] ${
                  isUp ? "bg-red-500/[0.04] dark:bg-red-500/[0.06]" : isDown ? "bg-blue-500/[0.04] dark:bg-blue-500/[0.06]" : "bg-muted/30"
                }`}
              >
                <div className={`absolute left-0 top-2 bottom-2 w-[2px] rounded-full ${isUp ? "bg-red-400/60" : isDown ? "bg-blue-400/60" : "bg-border/40"}`} />
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground/60 font-medium truncate">{item.name}</span>
                  {(() => { const ts = pickTimestamp(item, TODAY_KST); return ts && <span className="text-[8px] text-muted-foreground/30 tabular-nums shrink-0" title={item.price_at ? `가격 시각 (시장 마감)` : `cron 수집 시각`}>{ts}</span> })()}
                </div>
                <span className="text-[14px] font-bold tabular-nums tracking-tight text-foreground leading-snug">{priceStr}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] font-semibold tabular-nums ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/35"}`}>
                    {isUp ? "▲" : isDown ? "▼" : ""}{Math.abs(item.change_pct).toFixed(2)}%
                  </span>
                  {prev > 0 && <span className="text-[9px] text-muted-foreground/30 tabular-nums">전일 {prev.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 선물 히스토리 Bottom Sheet */}
      {showHistory && createPortal(
        <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/25" onClick={() => setShowHistory(false)} />
          <div ref={sheetRef} className="relative w-full sm:w-[28rem] sm:max-w-[90vw] max-h-[95vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
            <div ref={handleRef} className="sticky top-0 z-10 bg-popover pt-3 px-3 sm:px-0 sm:pt-0">
              <div className="sm:hidden flex items-center justify-center mb-2 py-1 cursor-grab relative">
                <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">주요 선물 히스토리</span>
                <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground p-1 -m-1" aria-label="닫기">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="px-3 sm:px-0">
            {historyLoading ? (
              <p className="text-[10px] text-muted-foreground/50 text-center py-2">로딩 중...</p>
            ) : histDates.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/50 text-center py-2">히스토리 없음 (다음 수집 시 축적됩니다)</p>
            ) : (
              <>
              <MacroChart rows={histRows} dates={histDates} hidden={chartHidden} setHidden={setChartHidden} />
              <hr className="border-border/30 my-3" />
              <table className="w-full text-[10px] tabular-nums table-fixed">
                <colgroup>
                  <col className="w-20" />
                  {histRows.map(row => <col key={row.symbol} />)}
                </colgroup>
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
                      <td className="py-2 pr-2 font-medium whitespace-nowrap">
                        {date.slice(5).replace("-", "/")}
                        {date === TODAY_KST && <span className="ml-1 text-[10px] font-semibold text-primary bg-primary/10 px-1 py-0.5 rounded-full">오늘</span>}
                      </td>
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
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// 시각 표시 — price_at(가격 시점) 우선, 없으면 collected_at(cron 시각) fallback.
// 형식: 오늘이면 "HH:MM", 다른 날이면 "MM-DD HH:MM".
function pickTimestamp(item: { price_at?: string; collected_at?: string }, todayKst: string): string | null {
  const ts = item.price_at || item.collected_at
  if (!ts) return null
  if (ts.slice(0, 10) === todayKst) return ts.slice(11, 16)
  return ts.slice(5, 16)  // "MM-DD HH:MM"
}

// 입력 v 단위: 만원 (KIS FHPTJ04040000의 _ntby_tr_pbmn raw 단위)
//   abs ≥ 1,000만원 (= 1억) → "억"
//   abs ≥ 10,000,000만원 (= 1조) → "조"
function formatAmount(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 10_000_000) return (v / 10_000_000).toFixed(1) + "조"
  if (abs >= 1_000) return (v / 10_000).toFixed(1) + "억"
  return v.toFixed(0) + "만"
}

function InvestorTrendBar({ data, updatedAt, history, historyLoading, onRequestHistory }: { data: InvestorTrendDay[]; updatedAt?: string; history?: IndicatorHistoryData | null; historyLoading?: boolean; onRequestHistory?: () => void }) {
  const [showDetail, setShowDetail] = useState(false)
  const [activeMarket, setActiveMarket] = useState<"kospi" | "kosdaq">("kospi")
  const [investorHidden, setInvestorHidden] = useState<Set<string>>(new Set())
  const { handleRef, sheetRef } = useSwipeToDismiss(() => setShowDetail(false), 80, showDetail)
  useScrollLock(showDetail)

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
            {latest.date === TODAY_KST && <span className="ml-0.5 font-semibold text-primary bg-primary/10 px-1 py-0.5 rounded-full">오늘</span>}
            {updatedAt && <span> · {updatedAt.slice(11, 16)}</span>}
          </span>
          <button
            onClick={() => { if (onRequestHistory) onRequestHistory(); setShowDetail(true) }}
            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground/60 hover:text-primary bg-muted/60 hover:bg-primary/10 rounded px-1.5 py-0.5 transition-colors ml-1.5"
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
                      <span className="text-[10px] text-muted-foreground block leading-none mb-0.5">{label}</span>
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
        <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/25" onClick={() => setShowDetail(false)} />
          <div ref={sheetRef} className="relative w-full sm:w-[28rem] sm:max-w-[90vw] max-h-[95vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
            <div ref={handleRef} className="sm:hidden flex items-center justify-center mb-2 py-3 cursor-grab relative">
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
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
              const displayDays = merged.slice(0, 10).reverse()
              const chartDays = displayDays
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
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors ${active ? "" : "opacity-30"}`}
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
                  <table className="w-full text-[10px] tabular-nums table-fixed">
                    <colgroup>
                      <col className="w-20" />
                      <col /><col /><col /><col />
                    </colgroup>
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
                            <td className="py-1.5 pr-1 font-medium whitespace-nowrap">
                              {day.date.slice(5).replace("-", "/")}
                              {day.date === TODAY_KST && <span className="ml-1 text-[10px] font-semibold text-primary bg-primary/10 px-1 py-0.5 rounded-full">오늘</span>}
                            </td>
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
            <p className="text-[10px] text-muted-foreground/50 mt-1">단위: 백만원 (1조 = 10,000억)</p>
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
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 mb-1">
        <button
          onClick={() => setHidden(prev => prev.size === 0 ? new Set(rows.map(r => r.name)) : new Set())}
          className="text-[9px] px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors shrink-0"
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
              className={`text-[9px] px-1.5 py-0.5 rounded transition-colors shrink-0 ${active ? "font-semibold" : "opacity-30"}`}
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

export function MacroIndicators({ data, history, historyLoading, onRequestHistory, kospiIndex, kosdaqIndex }: MacroIndicatorsProps) {
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedIndicator, setSelectedIndicator] = useState<string | null>(null)
  const [chartHidden, setChartHidden] = useState<Set<string>>(new Set())
  const { handleRef, sheetRef } = useSwipeToDismiss(() => setShowHistory(false), 80, showHistory)
  useScrollLock(showHistory)

  if (!data?.indicators?.length) return null

  // KOSPI/KOSDAQ를 indicatorMap에 주입 (별도 props → 통합)
  const indicatorMap = new Map(data.indicators.map((i) => [i.symbol, i]))
  // investorTrend는 IndexAlertSection에서 사용, 여기서는 미사용
  const macroCollectedAt = data.updated_at?.slice(0, 16)
  // 코스피/코스닥: yfinance ^KS11/^KQ11 우선, 없으면 kospiIndex props fallback
  if (!indicatorMap.has("^KS11") && kospiIndex?.current) {
    indicatorMap.set("^KS11", { symbol: "^KS11", name: "코스피", price: kospiIndex.current, change: 0, change_pct: 0, source: "kis", collected_at: macroCollectedAt })
  }
  if (!indicatorMap.has("^KQ11") && kosdaqIndex?.current) {
    indicatorMap.set("^KQ11", { symbol: "^KQ11", name: "코스닥", price: kosdaqIndex.current, change: 0, change_pct: 0, source: "kis", collected_at: macroCollectedAt })
  }

  // 접힌 상태: 펼친 상태와 동일 순서
  const SUMMARY_SKIP = new Set(["NQ=F"])
  const priorityOrder = ["FNG", "^VIX", "^KS11", "^KQ11", "^DJI", "^GSPC", "^IXIC", "^STOXX50E", "000001.SS", "^N225", "KOSPI200", "MU", "SOXX", "EWY", "KORU", "069500"]
  const summaryItems = [
    ...priorityOrder.map(sym => indicatorMap.get(sym)).filter(Boolean),
    ...data.indicators.filter(i => !priorityOrder.includes(i.symbol) && !SUMMARY_SKIP.has(i.symbol)),
  ].filter(i => !SUMMARY_SKIP.has((i as typeof data.indicators[0]).symbol)) as typeof data.indicators

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
            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground/60 hover:text-primary bg-muted/60 hover:bg-primary/10 rounded px-1.5 py-0.5 transition-colors ml-1.5"
          >
            <History className="w-3 h-3" />
            히스토리
          </span>
          <span className="ml-auto text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>

        {/* 접힌 상태: 전체 항목 가로 스크롤 */}
        {!expanded && (
          <div className="grid grid-cols-7 gap-px bg-border/30 rounded-md overflow-hidden mt-1">
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
                  className={`flex flex-col items-center py-1 ${bg}`}
                >
                  <span className="text-[10px] text-foreground/65 font-medium leading-none">{name}</span>
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
      {expanded && (() => {
        const fng = indicatorMap.get("FNG")
        const vix = indicatorMap.get("^VIX")
        const GLOBAL_INDEX_SYMBOLS = ["^KS11", "^KQ11", "^DJI", "^GSPC", "^IXIC", "^STOXX50E", "000001.SS", "^N225"]
        const globalIndices = GLOBAL_INDEX_SYMBOLS.map(s => indicatorMap.get(s)).filter(Boolean)
        const SKIP = new Set(["FNG", "^VIX", "NQ=F", ...GLOBAL_INDEX_SYMBOLS])
        const otherMacro = data.indicators.filter(i => !SKIP.has(i.symbol)).map(i =>
          i.symbol === "069500" ? { ...i, name: "KODEX 200" } : i
        )

        const fmtPrice = (item: { price: number; source: string }) =>
          item.source === "kis_futures" ? item.price.toFixed(2)
          : item.source === "kis_overseas" || item.source === "yfinance"
            ? item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : item.price.toLocaleString()

        const MacroCard = ({ item, onClick }: { item: { symbol: string; name: string; price: number; change: number; change_pct: number; source: string; collected_at?: string; price_at?: string }; onClick?: () => void }) => {
          const isUp = item.change_pct > 0
          const isDown = item.change_pct < 0
          const prev = item.price - item.change
          const ts = pickTimestamp(item, TODAY_KST)
          return (
            <div
              onClick={onClick}
              className={`relative rounded-lg px-3 py-2 cursor-pointer transition-all duration-200 hover:scale-[1.01] overflow-hidden ${
                isUp ? "bg-red-500/[0.04] dark:bg-red-500/[0.06]" : isDown ? "bg-blue-500/[0.04] dark:bg-blue-500/[0.06]" : "bg-muted/30"
              }`}
            >
              <div className={`absolute left-0 top-2 bottom-2 w-[2px] rounded-full ${isUp ? "bg-red-400/60" : isDown ? "bg-blue-400/60" : "bg-border/40"}`} />
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground/60 font-medium truncate">{item.name}</span>
                {ts && <span className="text-[8px] text-muted-foreground/30 tabular-nums shrink-0" title={item.price_at ? "가격 시각 (시장 마감)" : "cron 수집 시각"}>{ts}</span>}
              </div>
              <span className="text-[14px] font-bold tabular-nums tracking-tight text-foreground leading-snug">{fmtPrice(item)}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] font-semibold tabular-nums ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/35"}`}>
                  {isUp ? "▲" : isDown ? "▼" : ""}{Math.abs(item.change_pct).toFixed(2)}%
                </span>
                {prev > 0 && <span className="text-[9px] text-muted-foreground/30 tabular-nums">전일 {prev.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
              </div>
            </div>
          )
        }

        const SectionLabel = ({ children }: { children: React.ReactNode }) => (
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">{children}</span>
            <div className="flex-1 h-px bg-border/30" />
          </div>
        )

        return (
          <div className="mt-2 px-1 space-y-3">
            {/* 1. F&G + VIX */}
            {(fng || vix) && (
              <div className="grid grid-cols-2 gap-2">
                {fng && (
                  <div
                    onClick={() => setSelectedIndicator("FNG")}
                    className="rounded-lg px-3 py-2.5 cursor-pointer transition-all hover:scale-[1.01] bg-gradient-to-br from-amber-50/60 to-orange-50/30 dark:from-amber-500/[0.06] dark:to-orange-500/[0.03] border border-amber-200/30 dark:border-amber-500/10"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/60 font-medium">공포·탐욕</span>
                      <span className="text-lg font-black tabular-nums text-foreground">{fng.price.toFixed(1)}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 via-amber-400 to-red-500 relative mt-1.5 opacity-80">
                      <div
                        className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow-md border-2 border-foreground/50"
                        style={{ left: `${Math.min(96, Math.max(4, fng.price))}%`, transform: "translate(-50%, -50%)" }}
                      />
                    </div>
                    <span className={`text-[10px] font-semibold mt-1 block ${fng.price >= 75 ? "text-red-500" : fng.price >= 55 ? "text-amber-500" : fng.price >= 45 ? "text-muted-foreground/50" : fng.price >= 25 ? "text-blue-400" : "text-blue-500"}`}>
                      {fng.price >= 75 ? "극단적 탐욕" : fng.price >= 55 ? "탐욕 구간" : fng.price >= 45 ? "중립" : fng.price >= 25 ? "공포 구간" : "극단적 공포"}
                    </span>
                  </div>
                )}
                {vix && (
                  <div
                    onClick={() => setSelectedIndicator("^VIX")}
                    className={`rounded-lg px-3 py-2.5 cursor-pointer transition-all hover:scale-[1.01] border ${
                      vix.price >= 30 ? "bg-gradient-to-br from-red-50/60 to-rose-50/30 dark:from-red-500/[0.06] dark:to-rose-500/[0.03] border-red-200/30 dark:border-red-500/10"
                      : vix.price >= 20 ? "bg-gradient-to-br from-amber-50/40 to-yellow-50/20 dark:from-amber-500/[0.04] dark:to-yellow-500/[0.02] border-amber-200/20 dark:border-amber-500/8"
                      : "bg-gradient-to-br from-emerald-50/40 to-green-50/20 dark:from-emerald-500/[0.04] dark:to-green-500/[0.02] border-emerald-200/20 dark:border-emerald-500/8"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/60 font-medium">VIX</span>
                      <span className="text-lg font-black tabular-nums text-foreground">{vix.price.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 relative mt-1.5 opacity-80">
                      <div
                        className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow-md border-2 border-foreground/50"
                        style={{ left: `${Math.min(96, Math.max(4, vix.price / 40 * 100))}%`, transform: "translate(-50%, -50%)" }}
                      />
                    </div>
                    <span className={`text-[10px] font-semibold mt-1 block ${vix.price >= 30 ? "text-red-500" : vix.price >= 20 ? "text-amber-500" : "text-emerald-500"}`}>
                      {vix.price >= 30 ? "공포 구간" : vix.price >= 20 ? "보통" : "안정 구간"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 2. 글로벌 지수 */}
            {globalIndices.length > 0 && (
              <div>
                <SectionLabel>글로벌 지수</SectionLabel>
                <div className="grid grid-cols-2 gap-1.5">
                  {globalIndices.map(item => item && (
                    <MacroCard key={item.symbol} item={item} onClick={() => setSelectedIndicator(item.symbol)} />
                  ))}
                </div>
              </div>
            )}

            {/* 3. 글로벌 매크로 */}
            {otherMacro.length > 0 && (
              <div>
                <SectionLabel>글로벌 매크로</SectionLabel>
                <div className="grid grid-cols-2 gap-1.5">
                  {otherMacro.map(item => (
                    <MacroCard key={item.symbol} item={item} onClick={() => setSelectedIndicator(item.symbol)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

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
        <FuturesBar data={data.futures} updatedAt={data.updated_at} history={history} historyLoading={historyLoading} onRequestHistory={onRequestHistory}
          extraFutures={data.indicators.filter(i => i.symbol === "NQ=F").map(i => ({ symbol: i.symbol, name: i.name, price: i.price, change: i.change, change_pct: i.change_pct, status: i.change_pct > 0 ? "up" : i.change_pct < 0 ? "down" : "flat", source: i.source, collected_at: i.collected_at }))}
        />
      )}

      {/* 투자자 수급 */}
      {data.investor_trend && data.investor_trend.length > 0 && (
        <InvestorTrendBar data={data.investor_trend} updatedAt={data.updated_at} history={history} historyLoading={historyLoading} onRequestHistory={onRequestHistory} />
      )}

      {/* 히스토리 Bottom Sheet */}
      {showHistory && createPortal(
        <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/25" onClick={() => setShowHistory(false)} />
          <div ref={sheetRef} className="relative w-full sm:w-96 sm:max-w-[90vw] max-h-[95vh] overflow-y-auto bg-popover text-popover-foreground rounded-t-xl sm:rounded-xl shadow-xl border border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
            <div ref={handleRef} className="sm:hidden flex items-center justify-center mb-2 py-3 cursor-grab relative">
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
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
              <div className="overflow-x-auto -mx-3 px-3">
              <table className="text-[10px] tabular-nums" style={{ minWidth: Math.max(320, 52 + historyRows.length * 44) }}>
                <thead>
                  <tr className="text-foreground/80 border-b border-border/30">
                    <th className="text-left py-1.5 pr-2 font-semibold sticky left-0 bg-popover z-10 whitespace-nowrap">날짜</th>
                    {historyRows.map((row) => {
                      const active = chartHidden.size > 0 && !chartHidden.has(row.name)
                      return (
                        <th key={row.symbol} className={`text-right py-1.5 px-1 font-semibold whitespace-nowrap ${active ? "bg-primary/8" : chartHidden.size > 0 ? "opacity-30" : ""}`}>{row.name}</th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {dates.map((date, di) => (
                    <tr key={date} className={`border-t border-border/15 ${di % 2 === 1 ? "bg-muted/30" : ""}`}>
                      <td className="py-1.5 pr-2 font-medium whitespace-nowrap sticky left-0 bg-popover z-10">
                        {date.slice(5).replace("-", "/")}
                        {date === TODAY_KST && <span className="ml-1 text-[9px] font-semibold text-primary bg-primary/10 px-1 py-0.5 rounded-full">오늘</span>}
                      </td>
                      {historyRows.map((row) => {
                        const active = chartHidden.size > 0 && !chartHidden.has(row.name)
                        const dimmed = chartHidden.size > 0 && chartHidden.has(row.name)
                        const entry = row.entries.find(e => e.date === date)
                        if (!entry) return <td key={row.symbol} className={`text-right py-1.5 px-1 text-muted-foreground/20 ${active ? "bg-primary/8" : ""}`}>—</td>
                        const isUp = entry.change_pct > 0
                        const isDown = entry.change_pct < 0
                        return (
                          <td
                            key={row.symbol}
                            className={`text-right py-1.5 px-1 font-semibold whitespace-nowrap ${active ? "bg-primary/8" : ""} ${dimmed ? "opacity-30" : ""} ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground/40"}`}
                          >
                            {isUp ? "+" : ""}{entry.change_pct.toFixed(1)}
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
