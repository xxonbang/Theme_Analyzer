/** 기준별 색상 및 라벨 정의 (우선순위 순) — 단일 정의, 전체 컴포넌트에서 공유 */
export const CRITERIA_CONFIG = [
  { key: "bnf", dot: "bg-purple-600", badge: "bg-purple-500/15 text-purple-700", label: "BNF", shortLabel: "BNF", warning: false, description: "EMA25 대비 -20% 이상 하락 + RSI 30 미만 + MACD 골든크로스. 바닥 반등 시그널." },
  { key: "high_breakout", dot: "bg-red-500", badge: "bg-red-500/15 text-red-700", label: "전고점 돌파", shortLabel: "전고점", warning: false, description: "최근 60일 내 최고가를 돌파한 종목. 신고가 갱신은 강한 상승 추세를 의미합니다." },
  { key: "supply_demand", dot: "bg-blue-500", badge: "bg-blue-500/15 text-blue-700", label: "외국인/기관 수급", shortLabel: "수급", warning: false, description: "외국인과 기관이 동시에 순매수하는 종목. 스마트머니 유입 신호로 해석됩니다." },
  { key: "program_trading", dot: "bg-violet-500", badge: "bg-violet-500/15 text-violet-700", label: "프로그램 매매", shortLabel: "프로그램", warning: false, description: "프로그램 순매수가 유입된 종목. 기관 알고리즘 매수세가 확인됩니다." },
  { key: "momentum_history", dot: "bg-orange-500", badge: "bg-orange-500/15 text-orange-700", label: "끼 보유", shortLabel: "끼", warning: false, description: "과거 상한가 또는 15% 이상 급등 이력이 있는 종목. 테마 부각 시 폭발력이 기대됩니다." },
  { key: "resistance_breakout", dot: "bg-yellow-400", badge: "bg-yellow-400/20 text-yellow-700", label: "저항선 돌파", shortLabel: "저항선", warning: false, description: "주요 이동평균선(20일/60일) 저항을 돌파한 종목. 기술적 매수 신호입니다." },
  { key: "ma_alignment", dot: "bg-teal-500", badge: "bg-teal-500/15 text-teal-700", label: "정배열", shortLabel: "정배열", warning: false, description: "5일 > 20일 > 60일 이동평균선 정배열 상태. 안정적인 상승 추세를 나타냅니다." },
  { key: "top30_trading_value", dot: "bg-fuchsia-500", badge: "bg-fuchsia-500/15 text-fuchsia-700", label: "거래대금 TOP30", shortLabel: "TOP30", warning: false, description: "거래대금 상위 30위 이내 종목. 시장의 관심과 유동성이 집중되고 있습니다." },
  { key: "market_cap", dot: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-700", label: "시가총액", shortLabel: "시총", warning: false, description: "시가총액 5,000억원 이상의 중대형주. 유동성과 안정성이 확보된 종목입니다." },
  { key: "short_selling", dot: "bg-red-600", badge: "bg-red-500/15 text-red-800", label: "공매도 경고", shortLabel: "공매도", warning: true, description: "공매도 비율이 높아 하방 압력이 존재합니다. 매수 시 주의가 필요합니다." },
  { key: "overheating", dot: "bg-amber-500", badge: "bg-amber-500/15 text-amber-800", label: "과열 경고", shortLabel: "과열", warning: true, description: "RSI 과매수 구간 또는 단기 급등으로 과열 상태입니다. 조정 가능성에 유의하세요." },
  { key: "reverse_alignment", dot: "bg-indigo-500", badge: "bg-indigo-500/15 text-indigo-700", label: "역배열 경고", shortLabel: "역배열", warning: true, description: "이동평균선이 역배열(60일 > 20일 > 5일) 상태로 하락 추세입니다." },
] as const

/** 특수 기준 설명 (CRITERIA_CONFIG에 포함되지 않는 항목) */
export const SPECIAL_CRITERIA_DESCRIPTIONS: Record<string, string> = {
  "52w_high": "현재가가 52주(1년) 최고가를 갱신한 종목. 장기적으로 가장 강한 상승 신호입니다.",
  "all_met": "모든 선정 기준을 충족한 종목. 가장 높은 종합 점수를 받았습니다.",
}
