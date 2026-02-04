import { useEffect, useRef, useState } from "react"
import { X, Calendar, Clock, Loader2, AlertCircle, Sparkles, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GroupedHistory, HistoryEntry } from "@/types/history"

interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
  groupedHistory: GroupedHistory[]
  onSelect: (entry: HistoryEntry) => void
  loading: boolean
  error: string | null
}

export function HistoryModal({
  isOpen,
  onClose,
  groupedHistory,
  onSelect,
  loading,
  error,
}: HistoryModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [isClosing, setIsClosing] = useState(false)

  // 닫기 애니메이션 처리
  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 200)
  }

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  // 모달 열릴 때 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  // 배경 클릭으로 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  if (!isOpen) return null

  // 요일 계산
  const getWeekday = (dateStr: string) => {
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
    const [year, month, day] = dateStr.split("-")
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return weekdays[date.getDay()]
  }

  // 날짜 포맷 (2026-02-04 -> 02.04)
  const formatDateShort = (dateStr: string) => {
    const parts = dateStr.split("-")
    return `${parts[1]}.${parts[2]}`
  }

  // 상대적 날짜 표시
  const getRelativeDate = (dateStr: string) => {
    const today = new Date()
    const [year, month, day] = dateStr.split("-")
    const targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const diffTime = today.getTime() - targetDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "오늘"
    if (diffDays === 1) return "어제"
    if (diffDays < 7) return `${diffDays}일 전`
    return null
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "transition-all duration-200",
        isClosing ? "opacity-0" : "opacity-100"
      )}
      onClick={handleBackdropClick}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      {/* Modal Container */}
      <div
        ref={modalRef}
        className={cn(
          "relative w-full max-w-md max-h-[85vh] flex flex-col",
          "rounded-2xl overflow-hidden",
          // Glassmorphism effect
          "bg-gradient-to-b from-card/95 to-card/90",
          "backdrop-blur-xl",
          "border border-white/10 dark:border-white/5",
          // Shadow layers for depth
          "shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.05),0_12px_24px_rgba(0,0,0,0.1),0_32px_64px_rgba(0,0,0,0.15)]",
          // Animation
          "transition-all duration-300 ease-out",
          isClosing
            ? "scale-95 opacity-0 translate-y-4"
            : "scale-100 opacity-100 translate-y-0 animate-in zoom-in-95 slide-in-from-bottom-4"
        )}
      >
        {/* Gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-4">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

          <div className="relative flex items-center gap-3">
            {/* Animated icon container */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl blur-lg animate-pulse" />
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25">
                <Clock className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h2 className="font-bold text-lg tracking-tight">히스토리</h2>
              <p className="text-xs text-muted-foreground">과거 분석 결과 조회</p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className={cn(
              "relative group p-2 rounded-xl",
              "hover:bg-muted/80 active:scale-95",
              "transition-all duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            )}
          >
            <X className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-xl animate-pulse" />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-muted-foreground">불러오는 중...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl" />
                <div className="relative w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-red-500">{error}</p>
            </div>
          )}

          {/* Empty State - Modern Design */}
          {!loading && !error && groupedHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              {/* Animated illustration container */}
              <div className="relative mb-6">
                {/* Animated gradient rings */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full border border-dashed border-primary/20 animate-[spin_20s_linear_infinite]" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border border-dashed border-purple-500/20 animate-[spin_15s_linear_infinite_reverse]" />
                </div>

                {/* Center icon with gradient background */}
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <div className="absolute inset-4 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl blur-lg animate-pulse" />
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/50 border border-border/50 shadow-inner flex items-center justify-center">
                    {/* Clock with animated hands concept using pseudo elements */}
                    <div className="relative">
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-muted-foreground/60">
                        {/* Clock face */}
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="opacity-40" />
                        <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="1.5" className="opacity-60" />
                        {/* Hour marks */}
                        <circle cx="24" cy="8" r="1.5" fill="currentColor" className="opacity-40" />
                        <circle cx="40" cy="24" r="1.5" fill="currentColor" className="opacity-40" />
                        <circle cx="24" cy="40" r="1.5" fill="currentColor" className="opacity-40" />
                        <circle cx="8" cy="24" r="1.5" fill="currentColor" className="opacity-40" />
                        {/* Clock hands */}
                        <line x1="24" y1="24" x2="24" y2="14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="opacity-70" />
                        <line x1="24" y1="24" x2="32" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-50 origin-center animate-[spin_4s_linear_infinite]" style={{ transformOrigin: '24px 24px' }} />
                        {/* Center dot */}
                        <circle cx="24" cy="24" r="3" fill="currentColor" className="opacity-60" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Floating sparkles */}
                <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-500/60 animate-pulse" />
                <Sparkles className="absolute -bottom-2 -left-2 w-4 h-4 text-blue-500/60 animate-pulse" style={{ animationDelay: '0.5s' }} />
              </div>

              {/* Text content */}
              <div className="text-center space-y-2">
                <h3 className="text-base font-semibold text-foreground">
                  아직 저장된 히스토리가 없어요
                </h3>
                <p className="text-sm text-muted-foreground max-w-[240px] leading-relaxed">
                  분석이 실행되면 여기에 기록이 쌓입니다
                </p>
              </div>

              {/* Hint badge */}
              <div className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-primary/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="text-xs font-medium text-muted-foreground">매일 09:30, 21:00 자동 업데이트</span>
              </div>
            </div>
          )}

          {/* History List */}
          {!loading && !error && groupedHistory.length > 0 && (
            <div className="space-y-5">
              {groupedHistory.map((group, groupIndex) => (
                <div key={group.date} className="relative">
                  {/* Timeline connector */}
                  {groupIndex < groupedHistory.length - 1 && (
                    <div className="absolute left-[18px] top-10 bottom-0 w-px bg-gradient-to-b from-border to-transparent" />
                  )}

                  {/* Date Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn(
                      "relative flex items-center justify-center w-9 h-9 rounded-xl",
                      "bg-gradient-to-br from-primary/10 to-primary/5",
                      "border border-primary/20",
                      "shadow-sm"
                    )}>
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {formatDateShort(group.date)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({getWeekday(group.date)})
                      </span>
                      {getRelativeDate(group.date) && (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">
                          {getRelativeDate(group.date)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Time entries */}
                  <div className="ml-12 space-y-2">
                    {group.entries.map((entry) => (
                      <button
                        key={entry.filename}
                        onClick={() => onSelect(entry)}
                        className={cn(
                          "group relative w-full flex items-center gap-3 px-4 py-3 rounded-xl",
                          "text-left",
                          // Glassmorphism card effect
                          "bg-gradient-to-br from-muted/50 to-muted/30",
                          "hover:from-primary/10 hover:to-primary/5",
                          "border border-border/50 hover:border-primary/30",
                          // Shadow and depth
                          "shadow-sm hover:shadow-md hover:shadow-primary/5",
                          // Transitions
                          "transition-all duration-300 ease-out",
                          "hover:translate-x-1"
                        )}
                      >
                        {/* Time icon */}
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-lg",
                          "bg-background/50 group-hover:bg-primary/10",
                          "border border-border/50 group-hover:border-primary/20",
                          "transition-colors duration-300"
                        )}>
                          <Clock className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>

                        {/* Time text */}
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm tabular-nums group-hover:text-primary transition-colors">
                            {entry.time}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {entry.time === "09:30" && "장 시작 분석"}
                            {entry.time === "21:00" && "장 마감 분석"}
                            {entry.time !== "09:30" && entry.time !== "21:00" && "수동 분석"}
                          </span>
                        </div>

                        {/* Arrow indicator */}
                        <ArrowRight className={cn(
                          "w-4 h-4 text-muted-foreground/50",
                          "group-hover:text-primary group-hover:translate-x-1",
                          "transition-all duration-300"
                        )} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative px-5 py-4 border-t border-border/50">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 bg-gradient-to-t from-muted/30 to-transparent" />

          <div className="relative flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
            <p className="text-xs text-muted-foreground">
              최근 <span className="font-semibold text-foreground/80">30일</span>간의 분석 결과
            </p>
          </div>
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.3);
        }
      `}</style>
    </div>
  )
}
