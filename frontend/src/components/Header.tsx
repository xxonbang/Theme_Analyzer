import { useState, useEffect, useRef } from "react"
import { RefreshCw, LayoutGrid, List, Calendar, History, LineChart, LogOut, Sparkles, Sun, Moon, Search, CalendarClock, Briefcase, MoreVertical, BrainCircuit } from "lucide-react"
import { cn, getWeekday } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { EyeChartLogo } from "@/components/EyeChartLogo"
import { IconButton } from "@/components/IconButton"

type PageType = "home" | "ai-analysis" | "paper-trading" | "theme-forecast" | "portfolio"

interface HeaderProps {
  timestamp?: string
  onRefresh?: () => void
  loading?: boolean
  compactMode?: boolean
  onToggleCompact?: () => void
  onHistoryClick?: () => void
  isViewingHistory?: boolean
  refreshElapsed?: number
  currentPage?: PageType
  onPageChange?: (page: PageType) => void
  isAdmin?: boolean
  headerHidden?: boolean
  isDark?: boolean
  onToggleTheme?: () => void
  onCancelRefresh?: () => void
  onSearchClick?: () => void
  searchOpen?: boolean
  onScheduleClick?: () => void
  scheduleOpen?: boolean
}

export function Header({ timestamp, onRefresh, loading, compactMode, onToggleCompact, onHistoryClick, isViewingHistory, refreshElapsed, currentPage = "home", onPageChange, isAdmin, headerHidden, isDark, onToggleTheme, onCancelRefresh, onSearchClick, searchOpen, onScheduleClick, scheduleOpen }: HeaderProps) {
  const { signOut } = useAuth()
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipFading, setTooltipFading] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [logoLoading, setLogoLoading] = useState(false)
  const logoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 툴팁 자동 숨김 (3초 후 fade-out)
  useEffect(() => {
    if (showTooltip && !tooltipFading) {
      // 기존 타이머 클리어
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current)
      }
      // 3초 후 fade-out 시작
      tooltipTimeoutRef.current = setTimeout(() => {
        setTooltipFading(true)
        // fade-out 애니메이션 후 완전히 숨김
        setTimeout(() => {
          setShowTooltip(false)
          setTooltipFading(false)
        }, 300)
      }, 3000)
    }
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current)
      }
    }
  }, [showTooltip, tooltipFading])

  // more 메뉴 외부 클릭 닫기
  useEffect(() => {
    if (!moreMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false)
      }
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [moreMenuOpen])

  // 타임스탬프 클릭 핸들러
  const handleTimestampClick = () => {
    if (showTooltip) {
      // 이미 보이면 즉시 숨김
      setTooltipFading(true)
      setTimeout(() => {
        setShowTooltip(false)
        setTooltipFading(false)
      }, 300)
    } else {
      // 보이지 않으면 표시
      setShowTooltip(true)
      setTooltipFading(false)
    }
  }

  const handleToggleClick = () => {
    onToggleCompact?.()
  }

  // Refresh 버튼 클릭
  const handleRefreshClick = () => {
    if (loading) {
      onCancelRefresh?.()
      return
    }
    onRefresh?.()
  }

  const handleHistoryClick = () => {
    onHistoryClick?.()
  }

  // 타임스탬프 파싱
  const parseTimestamp = (ts: string) => {
    if (!ts) return null
    const [date, time] = ts.split(" ")
    if (!date || !time) return null

    const [year, month, day] = date.split("-")
    const [hour, minute] = time.split(":")

    return {
      year,
      month,
      day,
      hour,
      minute,
      weekday: getWeekday(`${year}-${month}-${day}`),
      fullDate: `${year}.${month}.${day}`,
      fullTime: `${hour}:${minute}`,
      shortDate: `${month}.${day}`,
    }
  }

  const getRelativeTime = (ts: string) => {
    if (!ts) return ""
    const [date, time] = ts.split(" ")
    if (!date || !time) return ""

    const [year, month, day] = date.split("-")
    const [hour, minute, second] = time.split(":")
    const timestamp = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second || "0")
    )

    const now = new Date()
    const diffMs = now.getTime() - timestamp.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "방금 전"
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 ${diffMins % 60}분 전`
    const remainHours = diffHours % 24
    return `${diffDays}일 ${remainHours}시간 전`
  }

  const parsed = timestamp ? parseTimestamp(timestamp) : null
  const relativeTime = timestamp ? getRelativeTime(timestamp) : null

  return (
    <header className={cn("sticky top-0 z-50 w-full border-b bg-card shadow-sm transition-transform duration-300 ease-out", headerHidden ? "-translate-y-full" : "translate-y-0")}>
      <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 max-w-[100vw]">
        {/* Logo & Title */}
        <button
          onClick={() => {
            onPageChange?.("home")
            onRefresh?.()
            window.scrollTo({ top: 0, behavior: "smooth" })
            setLogoLoading(true)
            if (logoTimerRef.current) clearTimeout(logoTimerRef.current)
            logoTimerRef.current = setTimeout(() => setLogoLoading(false), 6000)
          }}
          className="flex items-center gap-1.5 sm:gap-3 cursor-pointer shrink-0 rounded-lg px-1.5 py-1 -ml-1.5 active:scale-95"
          data-loading={loading || logoLoading || undefined}
        >
          <div className="flex items-center justify-center w-7 h-7 sm:w-10 sm:h-10">
            <EyeChartLogo className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg" />
          </div>
          <div className="text-left">
            <h1 className="text-sm sm:text-lg tracking-tight"><span className="font-normal">Theme</span><span className="font-extrabold">Analyzer</span></h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">오늘의 테마 분석</p>
          </div>
        </button>

        {/* Right Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          {/* Timestamp Badge - 클릭 가능 */}
          {parsed && (
            <div className="relative">
              <button
                onClick={handleTimestampClick}
                className="flex items-center gap-1 px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-full bg-gradient-to-r from-muted/80 to-muted/50 border border-border/50 shadow-sm cursor-pointer hover:border-primary/30 hover:shadow-md transition-all duration-200 focus:outline-none"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 hidden md:flex">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-medium">
                      {parsed.fullDate}
                      <span className="text-muted-foreground ml-0.5">({parsed.weekday})</span>
                    </span>
                  </div>
                  <span className="w-px h-3 bg-border/70 hidden md:block"></span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] sm:text-xs font-semibold tabular-nums">{parsed.fullTime}</span>
                  </div>
                </div>
              </button>

              {/* Tooltip - 3초 후 자동 fade-out */}
              {showTooltip && relativeTime && (
                <div
                  className={cn(
                    "absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5",
                    "bg-popover text-popover-foreground text-xs font-medium",
                    "rounded-md shadow-lg border border-border whitespace-nowrap z-50",
                    "transition-all duration-300",
                    tooltipFading ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
                  )}
                >
                  <span className="text-green-500">●</span> {relativeTime} 업데이트
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-l border-t border-border rotate-45"></div>
                </div>
              )}
            </div>
          )}

          {/* Search Button */}
          {onSearchClick && (
            <IconButton onClick={onSearchClick} active={searchOpen} aria-label="종목 검색" title="종목 검색">
              <Search className={cn("relative z-10 w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:scale-110", searchOpen && "text-primary")} />
            </IconButton>
          )}

          {/* Schedule Button */}
          {onScheduleClick && (
            <IconButton onClick={onScheduleClick} active={scheduleOpen} aria-label="수집 스케줄" title="수집 스케줄">
              <CalendarClock className={cn("relative z-10 w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:scale-110", scheduleOpen && "text-primary")} />
            </IconButton>
          )}

          {/* Page Navigation Buttons (desktop only) */}
          {onPageChange && (
            <>
              {isAdmin && <IconButton
                onClick={() => onPageChange(currentPage === "theme-forecast" ? "home" : "theme-forecast")}
                className="hidden sm:flex"
                active={currentPage === "theme-forecast"}
                activeClassName="ring-2 ring-amber-500/50 border-amber-500/30 bg-amber-500/5"
                aria-label="테마 예측"
                title="테마 예측"
              >
                <Sparkles className={cn(
                  "relative z-10 w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:scale-110",
                  currentPage === "theme-forecast" && "text-amber-500"
                )} />
              </IconButton>}

              <IconButton
                onClick={() => onPageChange(currentPage === "paper-trading" ? "home" : "paper-trading")}
                className="hidden sm:flex"
                active={currentPage === "paper-trading"}
                aria-label="모의투자"
                title="모의투자"
              >
                <LineChart className={cn(
                  "relative z-10 w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:scale-110",
                  currentPage === "paper-trading" && "text-primary"
                )} />
              </IconButton>

              <IconButton
                onClick={() => onPageChange(currentPage === "portfolio" ? "home" : "portfolio")}
                className="hidden sm:flex"
                active={currentPage === "portfolio"}
                activeClassName="ring-2 ring-violet-500/50 border-violet-500/30 bg-violet-500/5"
                aria-label="포트폴리오"
                title="포트폴리오"
              >
                <Briefcase className={cn(
                  "relative z-10 w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:scale-110",
                  currentPage === "portfolio" && "text-violet-500"
                )} />
              </IconButton>
            </>
          )}

          {/* History Button (desktop only) */}
          {onHistoryClick && (
            <IconButton
              onClick={handleHistoryClick}
              className="hidden sm:flex"
              active={isViewingHistory}
              aria-label="히스토리"
              title="히스토리"
            >
              <div className={cn("relative z-10 transition-all duration-300", "group-hover:rotate-12 group-active:rotate-0")}>
                <History className={cn("w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:scale-110", isViewingHistory && "text-primary")} />
              </div>
            </IconButton>
          )}

          {/* Theme Toggle */}
          {onToggleTheme && (
            <IconButton onClick={onToggleTheme} aria-label={isDark ? "라이트 모드" : "다크 모드"} title={isDark ? "라이트 모드" : "다크 모드"}>
              <div className="relative z-10 transition-transform duration-300 group-hover:rotate-12">
                {isDark ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />}
              </div>
            </IconButton>
          )}

          {/* Compact Mode Toggle */}
          {onToggleCompact && (
            <IconButton onClick={handleToggleClick} aria-label={compactMode ? "상세 보기" : "간단 보기"} title={compactMode ? "상세 보기" : "간단 보기"}>
              <div className={cn("relative z-10 transition-all duration-300", "group-hover:rotate-12 group-active:rotate-0")}>
                {compactMode ? <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:scale-110" /> : <List className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:scale-110" />}
              </div>
            </IconButton>
          )}

          {/* Refresh Elapsed Time (admin only) */}
          {isAdmin && loading && refreshElapsed != null && refreshElapsed > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums animate-pulse">
              {refreshElapsed <= 15 ? "시작 중..." : <><span className="hidden sm:inline">데이터 수집 중 </span>{refreshElapsed}초</>}
            </span>
          )}

          {/* More Menu (refresh + logout) */}
          <div className="relative" ref={moreMenuRef}>
            <IconButton onClick={() => setMoreMenuOpen(prev => !prev)} active={moreMenuOpen} aria-label="더보기" title="더보기">
              <MoreVertical className="relative z-10 w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </IconButton>

            {moreMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-40 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 animate-in fade-in-0 zoom-in-95 duration-150">
                {isAdmin && onRefresh && (
                  <button
                    onClick={() => { setMoreMenuOpen(false); handleRefreshClick() }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors",
                      loading ? "text-destructive hover:bg-destructive/5" : "text-foreground hover:bg-muted"
                    )}
                  >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    {loading ? "수집 취소" : "데이터 새로고침"}
                  </button>
                )}
                <button
                  onClick={() => { setMoreMenuOpen(false); signOut() }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile 2단 툴바 - 페이지 네비게이션 (sm:hidden) */}
      <div className="flex sm:hidden items-center px-2 py-1 pb-2 border-t border-border/30 bg-card overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-0.5 mx-auto">
          {onPageChange && (
            <button
              onClick={() => onPageChange("home")}
              className={cn(
                "flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
                currentPage === "home" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <LayoutGrid className="w-3 h-3" />
              홈
            </button>
          )}
          {onPageChange && (
            <button
              onClick={() => onPageChange(currentPage === "ai-analysis" ? "home" : "ai-analysis")}
              className={cn(
                "flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
                currentPage === "ai-analysis" ? "text-orange-600 bg-orange-500/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <BrainCircuit className="w-3 h-3" />
              AI분석
            </button>
          )}
          {onPageChange && (
            <button
              onClick={() => onPageChange(currentPage === "paper-trading" ? "home" : "paper-trading")}
              className={cn(
                "flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
                currentPage === "paper-trading" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <LineChart className="w-3 h-3" />
              모의투자
            </button>
          )}
          {onPageChange && (
            <button
              onClick={() => onPageChange(currentPage === "portfolio" ? "home" : "portfolio")}
              className={cn(
                "flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
                currentPage === "portfolio" ? "text-violet-600 bg-violet-500/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Briefcase className="w-3 h-3" />
              포트폴리오
            </button>
          )}
          {onHistoryClick && (
            <button
              onClick={() => onHistoryClick()}
              className={cn(
                "flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
                isViewingHistory ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <History className="w-3 h-3" />
              히스토리
            </button>
          )}
          {onPageChange && isAdmin && (
            <button
              onClick={() => onPageChange(currentPage === "theme-forecast" ? "home" : "theme-forecast")}
              className={cn(
                "flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
                currentPage === "theme-forecast" ? "text-amber-600 bg-amber-500/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Sparkles className="w-3 h-3" />
              예측
            </button>
          )}
        </div>
      </div>

    </header>
  )
}
