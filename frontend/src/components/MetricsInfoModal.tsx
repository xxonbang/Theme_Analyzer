import { useEffect } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export type MetricsPopupType = "vwap" | "rvol" | "rank30"

function VwapHelp() {
  return (
    <>
      <p className="leading-relaxed">
        오늘 하루 그 종목이 <strong className="text-foreground">평균적으로 얼마에 거래됐는지</strong> 보여주는 가격이에요.
      </p>
      <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-[13px] leading-relaxed">
        <div className="font-semibold text-foreground/90">어떻게 보면 좋을까요?</div>
        <div className="space-y-1.5">
          <div>
            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold text-red-500 bg-red-500/10 mr-1">현재가 &gt; VWAP</span>
            오늘 평균보다 비싸게 거래 중 — 매수자들이 평균 이상으로 사는 중. <strong className="text-foreground">강세 신호</strong>.
          </div>
          <div>
            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold text-blue-500 bg-blue-500/10 mr-1">현재가 &lt; VWAP</span>
            오늘 평균보다 싸게 거래 중 — <strong className="text-foreground">매수 기회</strong>이거나 약세 신호.
          </div>
        </div>
      </div>
      <div className="text-[12px] text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
        계산식: <span className="font-mono tabular-nums">누적 거래대금 ÷ 누적 거래량</span>
      </div>
    </>
  )
}

function Rank30Help() {
  return (
    <>
      <p className="leading-relaxed">
        <strong className="text-foreground">이 종목 자기 자신</strong>의 지난 30거래일 거래량 중 오늘이 몇 등인지 보여줘요. <span className="text-muted-foreground/80">(다른 종목과 비교 X)</span>
      </p>
      <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-[13px] leading-relaxed">
        <div className="font-semibold text-foreground/90 mb-1">등급 기준</div>
        <div className="flex gap-2">
          <span className="font-mono font-bold tabular-nums text-red-500 shrink-0 w-20">1위</span>
          <span>30일 중 거래량 최고 — <strong className="text-foreground">역대급 이슈</strong></span>
        </div>
        <div className="flex gap-2">
          <span className="font-mono font-bold tabular-nums text-red-500 shrink-0 w-20">상위 10%</span>
          <span>~3등 내 — 매우 활발</span>
        </div>
        <div className="flex gap-2">
          <span className="font-mono font-bold tabular-nums text-foreground/85 shrink-0 w-20">상위 50%</span>
          <span>평소 수준</span>
        </div>
        <div className="flex gap-2">
          <span className="font-mono font-bold tabular-nums text-muted-foreground shrink-0 w-20">상위 90%</span>
          <span>매우 한산</span>
        </div>
      </div>
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-[13px] leading-relaxed">
        <div className="font-semibold text-amber-700 dark:text-amber-400 mb-1">💡 RVOL 함정 검증</div>
        <p>RVOL이 높은데 30일 순위가 평범하면 → 20일 평균이 우연히 낮았을 뿐(가짜 신호). <strong className="text-foreground">두 지표 모두 상위면 진짜 폭증.</strong></p>
      </div>
    </>
  )
}

function RvolHelp() {
  return (
    <>
      <p className="leading-relaxed">
        지금 시각까지의 거래량이 <strong className="text-foreground">평소 대비 몇 배</strong>인지 알려주는 지표예요.
      </p>
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        최근 20일 평균 거래량과 비교하되, 정규장 경과 시간을 반영해서 공정하게 계산합니다.
      </p>
      <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-[13px] leading-relaxed">
        <div className="font-semibold text-foreground/90 mb-1">기준값 읽는 법</div>
        <div className="flex gap-2">
          <span className="font-mono font-bold tabular-nums text-foreground/85 shrink-0 w-14">1.0x</span>
          <span>평소 수준</span>
        </div>
        <div className="flex gap-2">
          <span className="font-mono font-bold tabular-nums text-amber-500 shrink-0 w-14">1.2~2.0x</span>
          <span>다소 활발 — 무언가 관심을 끄는 중</span>
        </div>
        <div className="flex gap-2">
          <span className="font-mono font-bold tabular-nums text-red-500 shrink-0 w-14">≥ 2.0x</span>
          <span>매우 활발 — <strong className="text-foreground">뉴스/이슈/추세 변화 가능성</strong></span>
        </div>
        <div className="flex gap-2">
          <span className="font-mono font-bold tabular-nums text-muted-foreground shrink-0 w-14">&lt; 1.0x</span>
          <span>평소보다 조용</span>
        </div>
      </div>
      <div className="text-[12px] text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
        계산식: <span className="font-mono tabular-nums">현재 누적 거래량 ÷ (20일 평균 × 정규장 경과 비율)</span>
      </div>
    </>
  )
}

interface MetricsInfoModalProps {
  popup: MetricsPopupType | null
  onClose: () => void
}

export function MetricsInfoModal({ popup, onClose }: MetricsInfoModalProps) {
  useEffect(() => {
    if (!popup) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [popup, onClose])

  if (!popup) return null

  return (
    <div
      className={cn("fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4")}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40">
          <h3 className="text-base font-bold text-foreground">
            {popup === "vwap" ? "VWAP — 거래량 가중 평균가"
              : popup === "rvol" ? "RVOL — 상대 거래량"
              : "30일 순위 — 자기 자신 비교"}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 -mr-1 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-foreground/90 space-y-3">
          {popup === "vwap" ? <VwapHelp />
            : popup === "rvol" ? <RvolHelp />
            : <Rank30Help />}
        </div>
      </div>
    </div>
  )
}
