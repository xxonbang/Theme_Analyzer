// 토스증권 종목 deep link.
// theme_lab의 StockDetailModal 분석을 기반으로 이전.
// AppsFlyer OneLink로 모바일은 토스 앱 자동 분기, 데스크탑은 web으로 진입.
//
// 흐름:
//   nextLandingUrl  = /stocks/A{code}?utm_source=tosssec&utm_medium=wts_mobile&utm_campaign=stock_detail
//   service         = https://service.tossinvest.com?nextLandingUrl=<encoded>
//   supertoss(앱)   = supertoss://securities?url=<encoded service>&clearHistory=true&swipeRefresh=true
//   webFallback     = https://contents.tossinvest.com/stocks/A{code}
//   OneLink         = https://toss.onelink.me/3563614660?{...&af_dp=<>&af_web_dp=<>&af_r=<>&af_force_deeplink=true}

/** 모바일 환경에서만 사용. 토스 앱으로 강제 분기. */
export function buildTossDeepUrl(code: string): string {
  const nextLandingUrl = `/stocks/A${code}?utm_source=tosssec&utm_medium=wts_mobile&utm_campaign=stock_detail`
  const service = `https://service.tossinvest.com?nextLandingUrl=${encodeURIComponent(nextLandingUrl)}`
  const supertoss = `supertoss://securities?url=${encodeURIComponent(service)}&clearHistory=true&swipeRefresh=true`
  const webFallback = `https://contents.tossinvest.com/stocks/A${code}`
  const params = new URLSearchParams({
    pid: "referral",
    c: "conversion_securities_performance",
    af_param_forwarding: "false",
    af_dp: supertoss,
    af_force_deeplink: "true",
    af_web_dp: webFallback,
    af_r: webFallback,
  })
  return `https://toss.onelink.me/3563614660?${params.toString()}`
}

/** 데스크탑 fallback (새 탭 web). a 태그 href에 그대로 사용. */
export function tossWebUrl(code: string): string {
  return `https://www.tossinvest.com/stocks/A${code}/order`
}

/** 모바일이면 deep link로 분기, 데스크탑은 기본 동작(새 탭 web) 유지. */
export function handleTossLinkClick(code: string, e: React.MouseEvent): void {
  if (typeof navigator === "undefined") return
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  if (!isMobile) return
  e.preventDefault()
  window.location.href = buildTossDeepUrl(code)
}

/** window.open 경로용 (a 태그가 아닌 직접 호출). 모바일은 deep link, 데스크탑은 새 탭 web. */
export function openTossLink(code: string): void {
  if (typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    window.location.href = buildTossDeepUrl(code)
  } else {
    window.open(tossWebUrl(code), "_blank")
  }
}
