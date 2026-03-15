import { useState, useMemo } from "react"
import { createPortal } from "react-dom"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { X } from "lucide-react"
import { cn, formatPrice } from "@/lib/utils"
import type { FundamentalInfo } from "@/types/stock"

interface RawDailyPrice {
  stck_bsop_date: string
  stck_clpr: string
}

interface DistributionPopupProps {
  stockName: string
  currentPrice: number
  rawDailyPrices: RawDailyPrice[]
  fundamental?: FundamentalInfo | null
  onClose: () => void
}

type Period = "1M" | "3M" | "6M" | "1Y"
const PERIOD_DAYS: Record<Period, number> = { "1M": 22, "3M": 66, "6M": 132, "1Y": 252 }
const PERIOD_LABELS: Record<Period, string> = { "1M": "1개월", "3M": "3개월", "6M": "6개월", "1Y": "1년" }

// 차트 상수
const CW = 360
const CH = 180
const PAD = { top: 20, right: 16, bottom: 32, left: 16 }
const PW = CW - PAD.left - PAD.right
const PH = CH - PAD.top - PAD.bottom

function normalPdf(x: number, mean: number, std: number): number {
  if (std === 0) return 0
  const exp = -0.5 * ((x - mean) / std) ** 2
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(exp)
}

function calcStats(values: number[]): { mean: number; std: number; min: number; max: number } | null {
  if (values.length < 3) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1)
  const std = Math.sqrt(variance)
  if (std === 0) return null
  return { mean, std, min: Math.min(...values), max: Math.max(...values) }
}

function BellCurveChart({
  values,
  current,
  label,
  unit,
  formatVal,
}: {
  values: number[]
  current: number
  label: string
  unit: string
  formatVal: (v: number) => string
}) {
  const stats = useMemo(() => calcStats(values), [values])

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
        데이터 부족
      </div>
    )
  }

  const { mean, std } = stats
  const lo = mean - 3.2 * std
  const hi = mean + 3.2 * std
  const zScore = std > 0 ? (current - mean) / std : 0

  // 분포 곡선 포인트 생성
  const STEPS = 120
  const curvePoints: { x: number; y: number; val: number }[] = []
  let maxY = 0
  for (let i = 0; i <= STEPS; i++) {
    const val = lo + (hi - lo) * (i / STEPS)
    const y = normalPdf(val, mean, std)
    if (y > maxY) maxY = y
    curvePoints.push({ x: 0, y, val })
  }

  // SVG 좌표 매핑
  const points = curvePoints.map((p) => ({
    x: PAD.left + ((p.val - lo) / (hi - lo)) * PW,
    y: PAD.top + PH - (p.y / maxY) * PH,
    val: p.val,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")

  // 면적 채우기 경로
  const fillD = pathD + ` L${points[points.length - 1].x.toFixed(1)},${PAD.top + PH} L${points[0].x.toFixed(1)},${PAD.top + PH} Z`

  // σ 밴드 위치
  const sigmaLines = [-2, -1, 0, 1, 2].map((s) => ({
    sigma: s,
    val: mean + s * std,
    x: PAD.left + ((mean + s * std - lo) / (hi - lo)) * PW,
    label: s === 0 ? "μ" : `${s > 0 ? "+" : ""}${s}σ`,
  }))

  // 현재값 위치
  const currentX = PAD.left + ((current - lo) / (hi - lo)) * PW
  const currentClampX = Math.max(PAD.left + 4, Math.min(PAD.left + PW - 4, currentX))

  // σ 구간별 색상
  const getSigmaBandColor = (z: number) => {
    const absZ = Math.abs(z)
    if (absZ <= 1) return "text-green-500"
    if (absZ <= 2) return "text-yellow-500"
    return "text-red-500"
  }

  const getSigmaLabel = (z: number) => {
    const absZ = Math.abs(z)
    if (absZ <= 1) return "정상 범위"
    if (absZ <= 2) return z > 0 ? "고평가 주의" : "저평가 구간"
    return z > 0 ? "과대평가" : "과소평가"
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="text-muted-foreground">Z-Score:</span>
          <span className={cn("font-mono font-semibold", getSigmaBandColor(zScore))}>
            {zScore >= 0 ? "+" : ""}{zScore.toFixed(2)}
          </span>
          <span className={cn("px-1 py-0.5 rounded text-[9px]", getSigmaBandColor(zScore))}>
            {getSigmaLabel(zScore)}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" style={{ maxHeight: 180 }}>
        {/* σ 밴드 영역 (±1σ, ±2σ) */}
        {[
          { from: -2, to: 2, opacity: 0.04 },
          { from: -1, to: 1, opacity: 0.06 },
        ].map(({ from, to, opacity }) => {
          const x1 = PAD.left + ((mean + from * std - lo) / (hi - lo)) * PW
          const x2 = PAD.left + ((mean + to * std - lo) / (hi - lo)) * PW
          return (
            <rect
              key={from}
              x={x1}
              y={PAD.top}
              width={x2 - x1}
              height={PH}
              fill="currentColor"
              className="text-blue-500"
              opacity={opacity}
            />
          )
        })}

        {/* σ 수직선 */}
        {sigmaLines.map((s) => (
          <g key={s.sigma}>
            <line
              x1={s.x} y1={PAD.top} x2={s.x} y2={PAD.top + PH}
              stroke="currentColor"
              className="text-muted-foreground"
              strokeWidth={s.sigma === 0 ? 0.8 : 0.4}
              strokeDasharray={s.sigma === 0 ? "none" : "2,2"}
              opacity={s.sigma === 0 ? 0.6 : 0.3}
            />
            <text
              x={s.x} y={PAD.top + PH + 10}
              textAnchor="middle" fontSize={8}
              className="fill-muted-foreground" opacity={0.6}
            >
              {s.label}
            </text>
            <text
              x={s.x} y={PAD.top + PH + 20}
              textAnchor="middle" fontSize={7}
              className="fill-muted-foreground" opacity={0.4}
            >
              {formatVal(s.val)}
            </text>
          </g>
        ))}

        {/* 분포 곡선 면적 */}
        <path d={fillD} fill="url(#bellGrad)" opacity={0.3} />

        {/* 분포 곡선 선 */}
        <path d={pathD} fill="none" stroke="currentColor" className="text-blue-400" strokeWidth={1.5} />

        {/* 현재값 수직선 */}
        <line
          x1={currentClampX} y1={PAD.top - 4} x2={currentClampX} y2={PAD.top + PH}
          stroke="currentColor" className="text-red-500" strokeWidth={1.5}
        />
        <circle cx={currentClampX} cy={PAD.top - 4} r={3} fill="currentColor" className="text-red-500" />
        <text
          x={currentClampX} y={PAD.top - 10}
          textAnchor="middle" fontSize={9} fontWeight="bold"
          className="fill-red-500"
        >
          {formatVal(current)}{unit}
        </text>

        {/* 그라디언트 정의 */}
        <defs>
          <linearGradient id="bellGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
        </defs>
      </svg>

      {/* 통계 요약 */}
      <div className="grid grid-cols-4 gap-1 mt-1 text-[9px] text-muted-foreground">
        <div className="text-center">
          <div className="opacity-60">평균</div>
          <div className="font-mono font-medium text-foreground">{formatVal(mean)}</div>
        </div>
        <div className="text-center">
          <div className="opacity-60">표준편차</div>
          <div className="font-mono font-medium text-foreground">{formatVal(std)}</div>
        </div>
        <div className="text-center">
          <div className="opacity-60">현재</div>
          <div className="font-mono font-medium text-foreground">{formatVal(current)}</div>
        </div>
        <div className="text-center">
          <div className="opacity-60">데이터</div>
          <div className="font-mono font-medium text-foreground">{values.length}일</div>
        </div>
      </div>
    </div>
  )
}

export default function DistributionPopup({
  stockName,
  currentPrice,
  rawDailyPrices,
  fundamental,
  onClose,
}: DistributionPopupProps) {
  const [period, setPeriod] = useState<Period>("3M")
  const { handleRef, sheetRef } = useSwipeToDismiss(onClose)

  const prices = useMemo(() => {
    const days = PERIOD_DAYS[period]
    return rawDailyPrices
      .slice(0, days)
      .map((d) => parseFloat(d.stck_clpr))
      .filter((v) => v > 0)
      .reverse()
  }, [rawDailyPrices, period])

  const eps = fundamental?.eps ?? null
  const perValues = useMemo(() => {
    if (!eps || eps <= 0) return []
    return prices.map((p) => p / eps)
  }, [prices, eps])

  const currentPer = eps && eps > 0 ? currentPrice / eps : null

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        {/* 드래그 핸들 */}
        <div ref={handleRef} className="flex justify-center pt-2 pb-1 cursor-grab">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-4 pb-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">{stockName} 분포 분석</h3>
              <p className="text-[10px] text-muted-foreground">
                정규분포 기반 가격·밸류에이션 위치 분석
              </p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 기간 선택 */}
          <div className="flex gap-1 mb-4">
            {(Object.keys(PERIOD_DAYS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "flex-1 py-1.5 text-[11px] rounded-lg font-medium transition-colors",
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* 가격 분포 차트 */}
          <div className="mb-4 p-3 rounded-xl bg-muted/30 border border-border/50">
            <BellCurveChart
              values={prices}
              current={currentPrice}
              label="가격 분포"
              unit="원"
              formatVal={(v) => formatPrice(Math.round(v))}
            />
          </div>

          {/* PER 분포 차트 */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            {eps && eps > 0 && currentPer ? (
              <BellCurveChart
                values={perValues}
                current={currentPer}
                label="PER 분포"
                unit="배"
                formatVal={(v) => v.toFixed(1)}
              />
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-muted-foreground">
                  {!eps ? "EPS 데이터 없음" : "EPS가 음수 (적자)로 PER 분석 불가"}
                </p>
              </div>
            )}
          </div>

          {/* 해석 가이드 */}
          <div className="mt-3 px-2 py-2 rounded-lg bg-muted/20 text-[9px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">해석 가이드</span>
            {" · "}
            <span className="text-green-500">±1σ</span> 정상 범위(68%)
            {" · "}
            <span className="text-yellow-500">±2σ</span> 주의 구간(95%)
            {" · "}
            <span className="text-red-500">±2σ 초과</span> 극단값
            {" · "}
            <span className="text-red-500">빨간 선</span>은 현재 위치
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
