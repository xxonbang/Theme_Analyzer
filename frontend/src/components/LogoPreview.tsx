import { cn } from "@/lib/utils"

/**
 * 로고 컨셉 비교 미리보기 컴포넌트
 * 사용법: 임시로 App.tsx에서 <LogoPreview /> 를 렌더링하면 3가지 로고를 비교 가능
 * 최종 채택 후 이 파일은 삭제
 */

// ─────────────────────────────────────────
// Concept A: "Rising Prism" (상승 프리즘)
// 컨셉: 3개의 평행사변형이 계단식으로 상승하며 "테마들이 분석되어 올라가는" 이미지
// 가장 오른쪽 바가 빛나는 엣지를 가짐 — 핵심 인사이트 발견을 의미
// 스타일: 기하학적, 미니멀, 금융 전문성
// ─────────────────────────────────────────
function LogoA({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("w-5 h-5", className)}>
      {/* Bar 1 - shortest, most transparent */}
      <rect x="4" y="18" width="6" height="10" rx="1.5" fill="currentColor" opacity="0.3" />
      {/* Bar 2 - medium */}
      <rect x="13" y="12" width="6" height="16" rx="1.5" fill="currentColor" opacity="0.55" />
      {/* Bar 3 - tallest, full opacity + glow edge */}
      <rect x="22" y="5" width="6" height="23" rx="1.5" fill="currentColor" opacity="0.9" />
      {/* Rising trend line */}
      <path
        d="M7 17 L16 11 L25 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      {/* Insight dot at peak */}
      <circle cx="25" cy="4" r="2" fill="currentColor" />
    </svg>
  )
}

// ─────────────────────────────────────────
// Concept B: "Convergence Scope" (수렴 스코프)
// 컨셉: 원형 렌즈/스코프 안에 수렴하는 3개의 트렌드 라인
// "여러 테마를 분석 렌즈로 포착하고 핵심을 찾아낸다"
// 스타일: 정밀함, 기술적 분석, 프로페셔널
// ─────────────────────────────────────────
function LogoB({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("w-5 h-5", className)}>
      {/* Outer scope ring */}
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.8" opacity="0.3" />
      {/* Inner focus ring */}
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1" opacity="0.15" strokeDasharray="2 3" />
      {/* Theme line 1 - from bottom-left rising */}
      <path d="M6 24 L12 18 L16 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      {/* Theme line 2 - from left-center rising */}
      <path d="M5 16 L11 15 L16 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      {/* Theme line 3 - from top-right (dominant) */}
      <path d="M16 14 L22 10 L27 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      {/* Convergence point - the key insight */}
      <circle cx="16" cy="14" r="2.5" fill="currentColor" opacity="0.9" />
      <circle cx="16" cy="14" r="1" fill="currentColor" />
    </svg>
  )
}

// ─────────────────────────────────────────
// Concept C: "Theme Signal" (테마 시그널)
// 컨셉: 추상적 파형 — 시장의 노이즈 속에서 시그널을 포착하는 모습
// 3개의 겹치는 웨이브가 하나의 명확한 피크로 수렴
// 스타일: 다이내믹, 현대적, 에너지
// ─────────────────────────────────────────
function LogoC({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("w-5 h-5", className)}>
      {/* Background wave - subtle context */}
      <path
        d="M2 22 Q8 20 12 18 Q16 16 18 12 Q20 8 22 10 Q24 12 26 14 Q28 16 30 15"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.15" fill="none"
      />
      {/* Mid wave - secondary signal */}
      <path
        d="M2 20 Q6 19 10 17 Q13 15 15 11 Q17 7 19 9 Q21 11 24 13 Q27 15 30 13"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" fill="none"
      />
      {/* Primary signal - the theme breakout */}
      <path
        d="M3 24 Q7 22 10 20 Q13 18 15 14 Q16 11 17 7 Q18 5 19 7 Q20 10 22 14 Q24 18 28 16"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" fill="none"
      />
      {/* Peak marker - the key discovery */}
      <circle cx="17.5" cy="5.5" r="2.2" fill="currentColor" opacity="0.85" />
      {/* Subtle area fill under primary line */}
      <path
        d="M3 24 Q7 22 10 20 Q13 18 15 14 Q16 11 17 7 Q18 5 19 7 Q20 10 22 14 Q24 18 28 16 L28 28 L3 28 Z"
        fill="currentColor" opacity="0.06"
      />
    </svg>
  )
}

// ─────────────────────────────────────────
// 미리보기 레이아웃
// ─────────────────────────────────────────
export function LogoPreview() {
  const concepts = [
    {
      name: "A: Rising Prism",
      korean: "상승 프리즘",
      description: "계단식 상승 바 + 트렌드 라인. 금융 차트의 직관적 표현. 가장 클래식하고 안정적.",
      Logo: LogoA,
    },
    {
      name: "B: Convergence Scope",
      korean: "수렴 스코프",
      description: "분석 렌즈 안에서 여러 테마가 한 점으로 수렴. 정밀한 분석을 상징.",
      Logo: LogoB,
    },
    {
      name: "C: Theme Signal",
      korean: "테마 시그널",
      description: "노이즈 속 시그널 포착. 다이내믹한 파형이 피크를 발견하는 순간.",
      Logo: LogoC,
    },
  ]

  return (
    <div className="p-6 space-y-8 max-w-2xl mx-auto">
      <h2 className="text-lg font-bold">로고 컨셉 비교</h2>

      {concepts.map(({ name, korean, description, Logo }) => (
        <div key={name} className="border rounded-xl p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-sm">{name}</h3>
            <p className="text-xs text-muted-foreground">{korean} — {description}</p>
          </div>

          {/* 다양한 사이즈 + 배경에서 미리보기 */}
          <div className="flex items-end gap-6">
            {/* 16px - 모바일 최소 */}
            <div className="text-center space-y-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-sm">
                <Logo className="w-4 h-4" />
              </div>
              <span className="text-[9px] text-muted-foreground">16px</span>
            </div>

            {/* 24px - 헤더 데스크톱 */}
            <div className="text-center space-y-1">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-sm">
                <Logo className="w-6 h-6" />
              </div>
              <span className="text-[9px] text-muted-foreground">24px</span>
            </div>

            {/* 32px - 로그인 */}
            <div className="text-center space-y-1">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-lg">
                <Logo className="w-8 h-8" />
              </div>
              <span className="text-[9px] text-muted-foreground">32px</span>
            </div>

            {/* 48px - 대형 표시 */}
            <div className="text-center space-y-1">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-lg">
                <Logo className="w-12 h-12" />
              </div>
              <span className="text-[9px] text-muted-foreground">48px</span>
            </div>
          </div>

          {/* 헤더 시뮬레이션 */}
          <div className="border rounded-lg p-3 bg-card flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-sm">
              <Logo className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight">ThemeAnalyzer</span>
              <p className="text-[10px] text-muted-foreground">오늘의 테마 분석</p>
            </div>
          </div>

          {/* 다크 배경 미리보기 */}
          <div className="border rounded-lg p-3 bg-[oklch(14%_0.005_260)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[oklch(65%_0.2_260)] to-[oklch(55%_0.15_260)] text-white flex items-center justify-center shadow-sm">
              <Logo className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-[oklch(92%_0.01_260)]">ThemeAnalyzer</span>
              <p className="text-[10px] text-[oklch(60%_0.015_260)]">오늘의 테마 분석</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// 개별 export (채택 후 EyeChartLogo를 대체)
export { LogoA, LogoB, LogoC }
