import { useState, useMemo } from "react"
import { createPortal } from "react-dom"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { X, Info } from "lucide-react"
import { cn, formatPrice } from "@/lib/utils"
import type { FundamentalInfo, StockVolumeProfile, VolumeProfileBin } from "@/types/stock"

interface RawDailyPrice {
  stck_bsop_date: string
  stck_clpr: string
}

interface DistributionPopupProps {
  stockName: string
  currentPrice: number
  rawDailyPrices: RawDailyPrice[]
  fundamental?: FundamentalInfo | null
  volumeProfile?: StockVolumeProfile | null
  onClose: () => void
}

type Period = "1D" | "2D" | "3D" | "4D" | "5D" | "1M"
const PERIOD_DAYS: Record<Period, number> = { "1D": 1, "2D": 2, "3D": 3, "4D": 4, "5D": 5, "1M": 22 }
const PERIOD_LABELS: Record<Period, string> = { "1D": "1일", "2D": "2일", "3D": "3일", "4D": "4일", "5D": "5일", "1M": "한달" }
const PERIOD_TO_VP: Record<Period, string> = { "1D": "1m", "2D": "1m", "3D": "1m", "4D": "1m", "5D": "1m", "1M": "1m" }

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
  if (values.length < 2) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1)
  const std = Math.sqrt(variance)
  if (std === 0) return null
  return { mean, std, min: Math.min(...values), max: Math.max(...values) }
}

/** 매물대 상위 N개 고거래량 구간 추출 (POC 제외) */
function getTopBins(bins: VolumeProfileBin[], pocPrice: number, count: number): VolumeProfileBin[] {
  return [...bins]
    .filter((b) => b.price !== pocPrice)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, count)
}

interface VpOverlay {
  pocPrice: number
  pocVolume: number
  resistanceBins: VolumeProfileBin[]
}

function BellCurveChart({
  values,
  current,
  label,
  unit,
  formatVal,
  vpOverlay,
  showPoc,
  showResistance,
}: {
  values: number[]
  current: number
  label: string
  unit: string
  formatVal: (v: number) => string
  vpOverlay?: VpOverlay | null
  showPoc: boolean
  showResistance: boolean
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

  // 값→X 좌표 변환 (매물대 오버레이용)
  const valToX = (v: number) => Math.max(PAD.left, Math.min(PAD.left + PW, PAD.left + ((v - lo) / (hi - lo)) * PW))

  const getSigmaBandColor = (z: number) => {
    const absZ = Math.abs(z)
    if (absZ <= 1) return "text-green-500"
    if (absZ <= 2) return "text-yellow-500"
    return "text-red-500"
  }

  const getSigmaLabel = (z: number) => {
    const absZ = Math.abs(z)
    if (absZ <= 1) return "평균 근처"
    if (absZ <= 2) return z > 0 ? "통계적 고위치" : "통계적 저위치"
    return z > 0 ? "극단적 고위치" : "극단적 저위치"
  }

  const getActionGuide = (z: number) => {
    if (z <= -2) return { text: "극단적 저위치", color: "text-blue-500 bg-blue-500/10" }
    if (z <= -1) return { text: "평균 하회", color: "text-blue-400 bg-blue-400/10" }
    if (z < 1) return { text: "평균 근처", color: "text-green-500 bg-green-500/10" }
    if (z < 2) return { text: "평균 상회", color: "text-amber-500 bg-amber-500/10" }
    return { text: "극단적 고위치", color: "text-red-500 bg-red-500/10" }
  }

  const action = getActionGuide(zScore)

  // 매물대 POC/지지저항이 차트 범위 내인지
  const isInRange = (v: number) => v >= lo && v <= hi

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-1.5 text-[10px] flex-wrap justify-end">
          <span className="text-muted-foreground">Z:</span>
          <span className={cn("font-mono font-semibold", getSigmaBandColor(zScore))}>
            {zScore >= 0 ? "+" : ""}{zScore.toFixed(2)}
          </span>
          <span className={cn("px-1 py-0.5 rounded text-[10px]", getSigmaBandColor(zScore))}>
            {getSigmaLabel(zScore)}
          </span>
          <span className={cn("px-1.5 py-0.5 rounded font-semibold text-[10px]", action.color)}>
            {action.text}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" style={{ maxHeight: 180 }}>
        {/* σ 밴드 영역 */}
        {[
          { from: -2, to: 2, opacity: 0.04 },
          { from: -1, to: 1, opacity: 0.06 },
        ].map(({ from, to, opacity }) => {
          const x1 = PAD.left + ((mean + from * std - lo) / (hi - lo)) * PW
          const x2 = PAD.left + ((mean + to * std - lo) / (hi - lo)) * PW
          return (
            <rect key={from} x={x1} y={PAD.top} width={x2 - x1} height={PH}
              fill="currentColor" className="text-blue-500" opacity={opacity} />
          )
        })}

        {/* σ 수직선 */}
        {sigmaLines.map((s) => (
          <g key={s.sigma}>
            <line x1={s.x} y1={PAD.top} x2={s.x} y2={PAD.top + PH}
              stroke="currentColor" className="text-muted-foreground"
              strokeWidth={s.sigma === 0 ? 0.8 : 0.4}
              strokeDasharray={s.sigma === 0 ? "none" : "2,2"}
              opacity={s.sigma === 0 ? 0.6 : 0.3} />
            <text x={s.x} y={PAD.top + PH + 10} textAnchor="middle" fontSize={8}
              className="fill-muted-foreground" opacity={0.6}>{s.label}</text>
            <text x={s.x} y={PAD.top + PH + 20} textAnchor="middle" fontSize={7}
              className="fill-muted-foreground" opacity={0.4}>{formatVal(s.val)}</text>
          </g>
        ))}

        {/* C: 매물대 지지/저항 구간 (showResistance) */}
        {showResistance && vpOverlay && vpOverlay.resistanceBins.map((bin, i) => {
          if (!isInRange(bin.price)) return null
          const bx = valToX(bin.price)
          const isSupport = bin.price <= current
          const srLabel = isSupport ? "S" : "R"
          const srColor = isSupport ? "#22c55e" : "#ef4444"
          return (
            <g key={`sr-${i}`}>
              <line x1={bx} y1={PAD.top} x2={bx} y2={PAD.top + PH}
                stroke={srColor} strokeWidth={1} strokeDasharray="4,2" opacity={0.5} />
              <text x={bx + 3} y={PAD.top + 10 + i * 10} fontSize={7}
                fill={srColor} opacity={0.8} fontWeight="bold">{srLabel}</text>
            </g>
          )
        })}

        {/* A: 매물대 POC (showPoc) */}
        {showPoc && vpOverlay && isInRange(vpOverlay.pocPrice) && (() => {
          const pocX = valToX(vpOverlay.pocPrice)
          return (
            <g>
              <line x1={pocX} y1={PAD.top} x2={pocX} y2={PAD.top + PH}
                stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.8} />
              <rect x={pocX - 12} y={PAD.top + PH - 14} width={24} height={12} rx={2}
                fill="#f59e0b" opacity={0.15} />
              <text x={pocX} y={PAD.top + PH - 5} textAnchor="middle" fontSize={7}
                fill="#f59e0b" fontWeight="bold">POC</text>
            </g>
          )
        })()}

        {/* 분포 곡선 */}
        <path d={fillD} fill="url(#bellGrad)" opacity={0.3} />
        <path d={pathD} fill="none" stroke="currentColor" className="text-blue-400" strokeWidth={1.5} />

        {/* 현재값 수직선 */}
        <line x1={currentClampX} y1={PAD.top - 4} x2={currentClampX} y2={PAD.top + PH}
          stroke="currentColor" className="text-red-500" strokeWidth={1.5} />
        <circle cx={currentClampX} cy={PAD.top - 4} r={3} fill="currentColor" className="text-red-500" />
        <text x={currentClampX} y={PAD.top - 10} textAnchor="middle" fontSize={9} fontWeight="bold"
          className="fill-red-500">{formatVal(current)}{unit}</text>

        <defs>
          <linearGradient id="bellGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
        </defs>
      </svg>

      {/* 통계 요약 */}
      <div className="grid grid-cols-4 gap-1 mt-1 text-[10px] text-muted-foreground">
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
      {values.length < 10 && (
        <div className="mt-1.5 text-center text-[10px] text-amber-500 font-medium">
          ⚠ 데이터 {values.length}개 — 참고용 (통계적 신뢰도 낮음)
        </div>
      )}
    </div>
  )
}

function MethodologyPopup({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[10000]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 bg-background rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between sticky top-0 bg-background rounded-t-2xl">
          <h3 className="text-sm font-semibold">분석 방법론</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 py-3 text-[11px] text-foreground/90 leading-relaxed space-y-3">
          <section>
            <h4 className="font-semibold text-xs mb-1">데이터 기반</h4>
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              <li><span className="text-foreground font-medium">가격 분포</span>: KIS(한국투자증권) API에서 수집한 종목별 일별 종가(최대 200거래일)</li>
              <li><span className="text-foreground font-medium">PER 분포</span>: 일별 종가 ÷ EPS(주당순이익)로 산출한 일별 PER</li>
              <li><span className="text-foreground font-medium">매물대(POC/S/R)</span>: KIS API 매물대 데이터 — 가격대별 거래량 분포</li>
            </ul>
          </section>
          <section>
            <h4 className="font-semibold text-xs mb-1">계산 방법</h4>
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              <li><span className="text-foreground font-medium">평균(μ)</span>: 선택 기간 내 종가(또는 PER)의 산술평균</li>
              <li><span className="text-foreground font-medium">표준편차(σ)</span>: 표본 표준편차 (N-1 보정)</li>
              <li><span className="text-foreground font-medium">Z-Score</span>: (현재값 - 평균) ÷ 표준편차 — 평균 대비 현재 위치를 σ 단위로 표현</li>
              <li><span className="text-foreground font-medium">정규분포 곡선</span>: 평균·표준편차 기반 확률밀도함수(PDF) 시각화</li>
            </ul>
          </section>
          <section>
            <h4 className="font-semibold text-xs mb-1">σ 구간 해석</h4>
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              <li><span className="text-green-500 font-medium">±1σ 이내</span>: 정상 범위 — 통계적으로 68%의 데이터가 분포하는 구간</li>
              <li><span className="text-yellow-500 font-medium">±1~2σ</span>: 주의 구간 — 95% 범위의 외곽, 추세 전환 가능성</li>
              <li><span className="text-red-500 font-medium">±2σ 초과</span>: 극단값 — 상위/하위 2.5%, 평균 회귀 가능성 높음</li>
            </ul>
          </section>
          <section>
            <h4 className="font-semibold text-xs mb-1">위치 해석 기준</h4>
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              <li><span className="text-blue-500 font-medium">-2σ 이하</span>: 극단적 저위치 — 선택 기간 내 하위 2.5% 구간</li>
              <li><span className="text-blue-400 font-medium">-1~-2σ</span>: 평균 하회 — 선택 기간 평균 이하</li>
              <li><span className="text-green-500 font-medium">±1σ 이내</span>: 평균 근처 — 통계적 정상 범위 (68%)</li>
              <li><span className="text-amber-500 font-medium">+1~+2σ</span>: 평균 상회 — 선택 기간 평균 이상</li>
              <li><span className="text-red-500 font-medium">+2σ 이상</span>: 극단적 고위치 — 선택 기간 내 상위 2.5% 구간</li>
            </ul>
          </section>
          <section className="pb-1">
            <h4 className="font-semibold text-xs mb-1">유의사항</h4>
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              <li>정규분포 가정은 주가의 단기 변동에 대한 근사적 모델이며, 실제 주가는 비대칭·두꺼운 꼬리 분포를 가질 수 있습니다.</li>
              <li>매매 지침은 통계적 참고 지표이며, 투자 결정은 다양한 요인을 종합 고려해야 합니다.</li>
              <li>기간이 짧을수록(1주) 데이터 수가 적어 신뢰도가 낮아질 수 있습니다.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function DistributionPopup({
  stockName,
  currentPrice,
  rawDailyPrices,
  fundamental,
  volumeProfile,
  onClose,
}: DistributionPopupProps) {
  const [period, setPeriod] = useState<Period>("5D")
  const [showPoc, setShowPoc] = useState(true)
  const [showResistance, setShowResistance] = useState(false)
  const [showMethodology, setShowMethodology] = useState(false)
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

  // 매물대 오버레이 데이터 (가격 차트용)
  const vpOverlay = useMemo((): VpOverlay | null => {
    if (!volumeProfile) return null
    const vpKey = PERIOD_TO_VP[period] as keyof StockVolumeProfile
    const vp = volumeProfile[vpKey]
    if (!vp || !vp.bins || vp.bins.length === 0) return null
    return {
      pocPrice: vp.poc_price,
      pocVolume: vp.poc_volume,
      resistanceBins: getTopBins(vp.bins, vp.poc_price, 3),
    }
  }, [volumeProfile, period])

  // PER 차트용 매물대 오버레이 (가격→PER 변환)
  const vpOverlayPer = useMemo((): VpOverlay | null => {
    if (!vpOverlay || !eps || eps <= 0) return null
    return {
      pocPrice: vpOverlay.pocPrice / eps,
      pocVolume: vpOverlay.pocVolume,
      resistanceBins: vpOverlay.resistanceBins.map((b) => ({ price: b.price / eps, volume: b.volume })),
    }
  }, [vpOverlay, eps])

  const hasVp = !!vpOverlay

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto overscroll-contain"
      >
        <div ref={handleRef} className="flex items-center justify-center pt-2 pb-1 cursor-grab relative">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
          <button onClick={onClose} className="absolute right-4 text-muted-foreground hover:text-foreground p-1" aria-label="닫기">
            <X className="w-4 h-4" />
          </button>
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
            <button onClick={() => setShowMethodology(true)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="분석 방법론">
              <Info className="w-4 h-4" />
            </button>
          </div>

          {/* 기간 선택 + 매물대 토글 */}
          <div className="flex gap-1 mb-2">
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

          {/* 매물대 오버레이 토글 */}
          {hasVp && (
            <div className="flex items-center gap-3 mb-3 text-[10px]">
              <button
                onClick={() => setShowPoc((v) => !v)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md transition-colors border",
                  showPoc
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-600"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                )}
              >
                <span className="w-2.5 h-0.5 rounded-full" style={{ background: showPoc ? "#f59e0b" : "#888", borderTop: "1px dashed" }} />
                POC
              </button>
              <button
                onClick={() => setShowResistance((v) => !v)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md transition-colors border",
                  showResistance
                    ? "border-purple-500/50 bg-purple-500/10 text-purple-600"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                )}
              >
                <span className="w-2.5 h-0.5 rounded-full" style={{ background: showResistance ? "#a855f7" : "#888", borderTop: "1px dashed" }} />
                지지/저항
              </button>
            </div>
          )}

          {/* 가격 분포 차트 */}
          <div className="mb-4 p-3 rounded-xl bg-muted/30 border border-border/50">
            <BellCurveChart
              values={prices}
              current={currentPrice}
              label="가격 분포"
              unit="원"
              formatVal={(v) => formatPrice(Math.round(v))}
              vpOverlay={vpOverlay}
              showPoc={showPoc}
              showResistance={showResistance}
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
                vpOverlay={vpOverlayPer}
                showPoc={showPoc}
                showResistance={showResistance}
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
          <div className="mt-3 px-2 py-2 rounded-lg bg-muted/20 text-[10px] text-muted-foreground leading-relaxed space-y-0.5">
            <div>
              <span className="font-medium text-foreground">구간 해석</span>
              {" · "}
              <span className="text-green-500">±1σ</span> 정상(68%)
              {" · "}
              <span className="text-yellow-500">±2σ</span> 주의(95%)
              {" · "}
              <span className="text-red-500">±2σ↑</span> 극단값
            </div>
            <div>
              <span className="font-medium text-foreground">위치 해석</span>
              {" · "}
              <span className="text-blue-500">-2σ↓</span> 극단적 저위치
              {" · "}
              <span className="text-blue-400">-1~-2σ</span> 평균 하회
              {" · "}
              <span className="text-green-500">±1σ</span> 평균 근처
              {" · "}
              <span className="text-amber-500">+1~+2σ</span> 평균 상회
              {" · "}
              <span className="text-red-500">+2σ↑</span> 극단적 고위치
            </div>
            {hasVp && (
              <div>
                <span className="font-medium text-foreground">매물대</span>
                {" · "}
                <span className="text-amber-500">POC</span> 최대 거래량 집중 가격대
                {" · "}
                <span className="text-green-500">S</span> 지지(현재가 이하)
                {" · "}
                <span className="text-red-500">R</span> 저항(현재가 이상)
              </div>
            )}
          </div>
        </div>
      </div>
      {showMethodology && <MethodologyPopup onClose={() => setShowMethodology(false)} />}
    </div>,
    document.body
  )
}
