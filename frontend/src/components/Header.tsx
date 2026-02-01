import { BarChart3, Clock, RefreshCw } from "lucide-react"

interface HeaderProps {
  timestamp?: string
  onRefresh?: () => void
  loading?: boolean
}

export function Header({ timestamp, onRefresh, loading }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Stock TOP10</h1>
            <p className="text-xs text-muted-foreground">거래량 + 등락률 교차 분석</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {timestamp && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">{timestamp}</span>
              <span className="sm:hidden">{timestamp.split(" ")[1]}</span>
            </div>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">새로고침</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
