import { BarChart3, Clock, RefreshCw } from "lucide-react"

interface HeaderProps {
  timestamp?: string
  onRefresh?: () => void
  loading?: boolean
}

export function Header({ timestamp, onRefresh, loading }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
      <div className="container flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary text-primary-foreground">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-lg">Stock TOP10</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden xs:block">거래량 + 등락률 교차 분석</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {timestamp && (
            <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-muted-foreground">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">{timestamp}</span>
              <span className="md:hidden">{timestamp.split(" ")[1]?.slice(0, 5) || timestamp}</span>
            </div>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">새로고침</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
