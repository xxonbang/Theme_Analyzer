// 가집계 수집 스케줄 (cron-job 실행 시각 기준, KST)
// 외국인 입력: 09:30, 11:20, 13:20, 14:30
// 기관 입력:   10:00, 11:20, 13:20, 14:30
const COLLECTION_SCHEDULE = [
  { time: "09:35", label: "1차" }, // 외국인 09:30 반영
  { time: "10:05", label: "2차" }, // 기관 10:00 반영
  { time: "11:25", label: "3차" }, // 외국인+기관 11:20 반영
  { time: "13:25", label: "4차" }, // 외국인+기관 13:20 반영
  { time: "14:35", label: "5차" }, // 외국인+기관 14:30 반영 (장중 최종)
] as const

const CONFIRMED_TIME = "18:05" // 장후 확정 + pykrx 교차검증

export function getInvestorScheduleInfo(
  updatedAt: string,
  isEstimated: boolean,
): { round: string; nextUpdate: string; label: string } | { label: "확정" } {
  if (!isEstimated) {
    return { label: "확정" }
  }

  // updatedAt: "2026-02-27T15:30:00" 형태에서 HH:MM 추출
  const timeStr = updatedAt.slice(11, 16)

  // 수집 시각 기준으로 어느 라운드에 해당하는지 판별
  // updatedAt이 해당 수집 시각 이후이면 그 라운드 데이터
  let matchedRound = 0
  for (let i = COLLECTION_SCHEDULE.length - 1; i >= 0; i--) {
    if (timeStr >= COLLECTION_SCHEDULE[i].time) {
      matchedRound = i + 1
      break
    }
  }

  if (matchedRound === 0) {
    // 09:35 이전 데이터 → 아직 첫 수집 전
    return { round: "0/5", nextUpdate: COLLECTION_SCHEDULE[0].time, label: "대기" }
  }

  const total = COLLECTION_SCHEDULE.length
  const nextIdx = matchedRound < total ? matchedRound : null
  const nextUpdate = nextIdx !== null ? COLLECTION_SCHEDULE[nextIdx].time : CONFIRMED_TIME

  return {
    round: `${matchedRound}/${total}`,
    nextUpdate,
    label: COLLECTION_SCHEDULE[matchedRound - 1].label,
  }
}
