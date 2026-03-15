import { useState, useMemo } from "react"
import { createPortal } from "react-dom"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { BarChart3, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { KosdaqIndex } from "@/types/stock"
import type { InvestorTrendDay } from "@/hooks/useMacroIndicators"

// 차트 상수
const CW = 340
const CH = 120
const PAD = { top: 10, right: 16, bottom: 22, left: 40 }
const PW = CW - PAD.left - PAD.right
const PH = CH - PAD.top - PAD.bottom

function MiniLineChart({
  values,
  labels,
  formatY,
  color,
  zeroLine,
}: {
  values: number[]
  labels: string[]
  formatY: (v: number) => string
  color: string
  zeroLine?: boolean
}) {
  if (values.length < 2) return null
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const range = maxV - minV || 1

  const pts = values.map((v, i) => ({
    x: PAD.left + (i / (values.length - 1)) * PW,
    y: PAD.top + PH - ((v - minV) / range) * PH,
  }))
  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")

  // Y축 3단계
  const yTicks = [0, 0.5, 1].map((r) => ({
    val: minV + r * range,
    y: PAD.top + PH - r * PH,
  }))

  // 0선 위치 (등락률 차트용)
  const zeroY = zeroLine && minV < 0 && maxV > 0
    ? PAD.top + PH - ((0 - minV) / range) * PH
    : null

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" style={{ maxHeight: 120 }}>
      {/* Y축 */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={t.y} x2={PAD.left + PW} y2={t.y}
            stroke="currentColor" className="text-border" strokeWidth={0.5} strokeDasharray="3,3" />
          <text x={PAD.left - 4} y={t.y + 3} textAnchor="end" fontSize={9}
            className="fill-muted-foreground" opacity={0.8}>{formatY(t.val)}</text>
        </g>
      ))}

      {/* 0선 */}
      {zeroY !== null && (
        <line x1={PAD.left} y1={zeroY} x2={PAD.left + PW} y2={zeroY}
          stroke="currentColor" className="text-muted-foreground" strokeWidth={0.6} strokeDasharray="4,3" opacity={0.4} />
      )}

      {/* X축 라벨 */}
      {labels.map((l, i) => {
        if (labels.length > 10 && i % 2 !== 0 && i !== labels.length - 1) return null
        // 마지막 라벨과 겹침 방지: 마지막 직전 라벨 스킵
        if (labels.length > 5 && i === labels.length - 2) return null
        const x = PAD.left + (i / (labels.length - 1)) * PW
        return (
          <text key={i} x={x} y={PAD.top + PH + 14} textAnchor="middle" fontSize={9}
            className="fill-muted-foreground" opacity={0.8}>{l}</text>
        )
      })}

      {/* 선 */}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" />

      {/* 포인트 */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill={color} />
      ))}
    </svg>
  )
}

type Tab = "change" | "ma"

function IndexDetailPopup({
  label,
  maData,
  trendData,
  market,
  onClose,
}: {
  label: string
  maData: KosdaqIndex
  trendData: InvestorTrendDay[]
  market: "kospi" | "kosdaq"
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>("change")
  const { handleRef, sheetRef } = useSwipeToDismiss(onClose)

  // 등락률 탭 데이터 (trendData: oldest→newest, 차트용 그대로 사용)
  const chartDays = trendData
  const changeValues = chartDays.map((d) => d[market].change_pct)
  const changeLabels = chartDays.map((d) => d.date.slice(5).replace("-", "/"))
  const indexValues = chartDays.map((d) => d[market].index)
  const indexLabels = changeLabels
  // 테이블용: 최신→과거 역순
  const tableDays = useMemo(() => [...trendData].reverse(), [trendData])

  // 이동평균선 탭 데이터
  const maValues = [
    { label: "MA5", value: maData.ma5 },
    { label: "MA10", value: maData.ma10 },
    { label: "MA20", value: maData.ma20 },
    { label: "MA60", value: maData.ma60 },
    { label: "MA120", value: maData.ma120 },
  ].filter(({ value }) => value > 0)

  // MA 차트: 현재가 + MA값들을 하나의 차트에
  const maChartValues = [maData.current, ...maValues.map((m) => m.value)]
  const maChartLabels = ["현재", ...maValues.map((m) => m.label)]

  const statusConfig: Record<string, { color: string; bg: string }> = {
    "정배열": { color: "text-emerald-600", bg: "bg-emerald-500/15 border-emerald-500/30" },
    "역배열": { color: "text-red-500", bg: "bg-red-500/15 border-red-500/30" },
    "혼합": { color: "text-muted-foreground", bg: "bg-muted border-border" },
  }
  const sc = statusConfig[maData.status] || statusConfig["혼합"]

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div ref={handleRef} className="flex justify-center pt-2 pb-1 cursor-grab">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="px-4 pb-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">{label}</h3>
              <p className="text-[10px] text-muted-foreground">
                현재 {maData.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 탭 */}
          <div className="flex gap-1 mb-3">
            {([
              { key: "change" as Tab, label: "등락률" },
              { key: "ma" as Tab, label: "이동평균선" },
            ]).map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 py-1.5 text-[11px] rounded-lg font-medium transition-colors",
                  tab === t.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}>
                {t.label}
              </button>
            ))}
          </div>

          {/* 등락률 탭 */}
          {tab === "change" && (
            <div className="space-y-3">
              {/* 지수 추이 차트 */}
              <div className="p-2 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-[10px] text-muted-foreground mb-1 px-1">지수 추이</p>
                <MiniLineChart
                  values={indexValues}
                  labels={indexLabels}
                  formatY={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  color="#6366f1"
                />
              </div>
              {/* 등락률 차트 */}
              <div className="p-2 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-[10px] text-muted-foreground mb-1 px-1">일별 등락률 (%)</p>
                <MiniLineChart
                  values={changeValues}
                  labels={changeLabels}
                  formatY={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
                  color={changeValues[changeValues.length - 1] >= 0 ? "#ef4444" : "#3b82f6"}
                  zeroLine
                />
              </div>
              {/* 테이블 */}
              <table className="w-full text-[10px] tabular-nums">
                <thead>
                  <tr className="text-foreground/80 border-b border-border/30">
                    <th className="text-left py-1.5 font-semibold">날짜</th>
                    <th className="text-right py-1.5 font-semibold">지수</th>
                    <th className="text-right py-1.5 font-semibold">등락률</th>
                    <th className="text-right py-1.5 font-semibold">전일대비</th>
                  </tr>
                </thead>
                <tbody>
                  {tableDays.map((day, di) => {
                    const d = day[market]
                    const prevDay = tableDays[di + 1]
                    const prevIdx = prevDay ? prevDay[market].index : null
                    const diff = prevIdx ? d.index - prevIdx : null
                    return (
                      <tr key={day.date} className={cn("border-t border-border/15", di % 2 === 1 && "bg-muted/30")}>
                        <td className="py-1.5 text-foreground/70 font-medium">{day.date.slice(5).replace("-", "/")}</td>
                        <td className="text-right py-1.5 font-medium">{d.index.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td className={cn("text-right py-1.5 font-semibold",
                          d.change_pct > 0 ? "text-red-500" : d.change_pct < 0 ? "text-blue-500" : "text-muted-foreground/40")}>
                          {d.change_pct > 0 ? "+" : ""}{d.change_pct.toFixed(2)}%
                        </td>
                        <td className={cn("text-right py-1.5",
                          diff && diff > 0 ? "text-red-500" : diff && diff < 0 ? "text-blue-500" : "text-muted-foreground/40")}>
                          {diff !== null ? `${diff > 0 ? "+" : ""}${diff.toFixed(2)}` : "-"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 이동평균선 탭 */}
          {tab === "ma" && (
            <div className="space-y-3">
              {/* MA 비교 차트 */}
              <div className="p-2 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-1 px-1">
                  <p className="text-[10px] text-muted-foreground">이동평균선 비교</p>
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-semibold border", sc.bg, sc.color)}>
                    {maData.status}
                  </span>
                </div>
                <MiniLineChart
                  values={maChartValues}
                  labels={maChartLabels}
                  formatY={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  color="#10b981"
                />
              </div>
              {/* MA 테이블 */}
              <table className="w-full text-[10px] tabular-nums">
                <thead>
                  <tr className="text-foreground/80 border-b border-border/30">
                    <th className="text-left py-1.5 font-semibold">구분</th>
                    <th className="text-right py-1.5 font-semibold">값</th>
                    <th className="text-right py-1.5 font-semibold">현재가 대비</th>
                    <th className="text-right py-1.5 font-semibold">괴리율</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border/15 bg-muted/20">
                    <td className="py-1.5 font-semibold text-foreground">현재</td>
                    <td className="text-right py-1.5 font-bold">{maData.current.toFixed(2)}</td>
                    <td className="text-right py-1.5">-</td>
                    <td className="text-right py-1.5">-</td>
                  </tr>
                  {maValues.map(({ label, value }, i) => {
                    const gap = maData.current - value
                    const gapPct = (gap / value) * 100
                    const isAbove = gap >= 0
                    return (
                      <tr key={label} className={cn("border-t border-border/15", i % 2 === 0 && "bg-muted/30")}>
                        <td className="py-1.5 font-medium text-foreground/70">{label}</td>
                        <td className="text-right py-1.5 font-medium">{value.toFixed(2)}</td>
                        <td className={cn("text-right py-1.5 font-semibold", isAbove ? "text-emerald-600" : "text-red-500")}>
                          {gap > 0 ? "+" : ""}{gap.toFixed(2)}
                        </td>
                        <td className={cn("text-right py-1.5 font-semibold", isAbove ? "text-emerald-600" : "text-red-500")}>
                          {gapPct > 0 ? "+" : ""}{gapPct.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

interface IndexAlertSectionProps {
  kospi?: KosdaqIndex
  kosdaq?: KosdaqIndex
  investorTrend?: InvestorTrendDay[]
}

export function IndexAlertSection({ kospi, kosdaq, investorTrend }: IndexAlertSectionProps) {
  const [popupMarket, setPopupMarket] = useState<"kospi" | "kosdaq" | null>(null)

  if (!kospi && !kosdaq) return null

  const latestTrend = investorTrend && investorTrend.length > 0 ? investorTrend[investorTrend.length - 1] : null

  const renderIndexCard = (market: "kospi" | "kosdaq", data: KosdaqIndex) => {
    const label = market === "kospi" ? "코스피 지수" : "코스닥 지수"
    const trend = latestTrend?.[market]
    const changePct = trend?.change_pct ?? null

    const statusConfig: Record<string, { bg: string; badge: string }> = {
      "정배열": { bg: "bg-emerald-500/10 border-emerald-500/30", badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
      "역배열": { bg: "bg-red-500/10 border-red-500/30", badge: "bg-red-500/15 text-red-700 border-red-500/30" },
      "혼합": { bg: "bg-muted border-border", badge: "bg-muted text-muted-foreground border-border" },
    }
    const sc = statusConfig[data.status] || statusConfig["혼합"]

    return (
      <button
        key={market}
        onClick={() => setPopupMarket(market)}
        className={cn("w-full text-left text-foreground border rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 transition-all duration-200 hover:opacity-80", sc.bg)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart3 className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />
            <span className="font-semibold text-xs sm:text-sm text-foreground/80 truncate">{label}</span>
            <span className={cn("text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full font-semibold border", sc.badge)}>
              {data.status}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm sm:text-base font-bold tabular-nums">
              {data.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            {changePct !== null && (
              <span className={cn(
                "text-[10px] sm:text-xs tabular-nums font-semibold px-1.5 py-0.5 rounded",
                changePct > 0 ? "text-red-500 bg-red-500/10" : changePct < 0 ? "text-blue-500 bg-blue-500/10" : "text-muted-foreground"
              )}>
                {changePct > 0 ? "+" : ""}{changePct.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      </button>
    )
  }

  const popupData = popupMarket === "kospi" ? kospi : popupMarket === "kosdaq" ? kosdaq : null

  return (
    <div className="mb-4 sm:mb-6 flex flex-col gap-1.5">
      {kospi && renderIndexCard("kospi", kospi)}
      {kosdaq && renderIndexCard("kosdaq", kosdaq)}

      {popupMarket && popupData && investorTrend && investorTrend.length > 0 && (
        <IndexDetailPopup
          label={popupMarket === "kospi" ? "코스피 지수" : "코스닥 지수"}
          maData={popupData}
          trendData={investorTrend}
          market={popupMarket}
          onClose={() => setPopupMarket(null)}
        />
      )}
    </div>
  )
}

// 하위 호환성
export function KosdaqIndexAlert({ data }: { data: KosdaqIndex }) {
  return (
    <div className="mb-4 sm:mb-6">
      <IndexAlertSection kosdaq={data} />
    </div>
  )
}
