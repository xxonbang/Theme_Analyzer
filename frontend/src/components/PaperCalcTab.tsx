import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { X, RefreshCw, Search } from "lucide-react"
import { cn, formatPrice, getChangeBgColor } from "@/lib/utils"
import { fetchKisPrices, searchKisStock, type KisStockPrice } from "@/lib/kis-api"
import { useAuth } from "@/hooks/useAuth"

interface PaperCalcItem {
  id: string
  code: string
  name: string
  assumedPrice: number
  quantity: number
  addedAt: string
}

interface PaperCalcTabProps {
  masterStocks: { code: string; name: string; market: string }[]
}

export function PaperCalcTab({ masterStocks }: PaperCalcTabProps) {
  const { user } = useAuth()
  const storageKey = `paper-calc-${user?.id ?? "anon"}`

  const [items, setItems] = useState<PaperCalcItem[]>([])
  const [livePrices, setLivePrices] = useState<Record<string, KisStockPrice>>({})
  const [refreshing, setRefreshing] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStock, setSelectedStock] = useState<{ code: string; name: string } | null>(null)
  const [assumedPrice, setAssumedPrice] = useState("")
  const [quantity, setQuantity] = useState("")
  const [kisSearching, setKisSearching] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as PaperCalcItem[]
        setItems(parsed)
      } catch { /* ignore */ }
    }
  }, [storageKey])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items))
  }, [items, storageKey])

  useEffect(() => {
    if (items.length === 0) return
    const codes = items.map(it => it.code).filter(c => !livePrices[c])
    if (codes.length === 0) return
    fetchKisPrices(codes).then(({ prices }) => {
      setLivePrices(prev => ({ ...prev, ...prices }))
    }).catch(() => {})
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q || selectedStock) return []
    return masterStocks
      .filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q))
      .slice(0, 8)
  }, [searchQuery, selectedStock, masterStocks])

  const selectStock = useCallback(async (code: string, name: string) => {
    setSelectedStock({ code, name })
    setSearchQuery("")
    setKisSearching(true)
    try {
      const result = await searchKisStock(code)
      if (result) {
        setLivePrices(prev => ({ ...prev, [code]: result }))
        setAssumedPrice(String(result.current_price))
      }
    } catch {
      // 실패해도 입력은 가능
    } finally {
      setKisSearching(false)
    }
  }, [])

  const resetForm = useCallback(() => {
    setSelectedStock(null)
    setAssumedPrice("")
    setQuantity("")
    setSearchQuery("")
    searchInputRef.current?.focus()
  }, [])

  const preview = useMemo(() => {
    if (!selectedStock) return null
    const p = parseInt(assumedPrice.replace(/,/g, ""))
    const q = parseInt(quantity.replace(/,/g, ""))
    if (!p || !q || p <= 0 || q <= 0) return null
    const cur = livePrices[selectedStock.code]?.current_price ?? p
    const invest = p * q
    const evalAmt = cur * q
    const profit = evalAmt - invest
    const rate = ((cur - p) / p) * 100
    return { p, q, cur, invest, evalAmt, profit, rate }
  }, [selectedStock, assumedPrice, quantity, livePrices])

  const addItem = useCallback(() => {
    if (!selectedStock || !preview) return
    const newItem: PaperCalcItem = {
      id: crypto.randomUUID(),
      code: selectedStock.code,
      name: selectedStock.name,
      assumedPrice: preview.p,
      quantity: preview.q,
      addedAt: new Date().toISOString(),
    }
    setItems(prev => [newItem, ...prev])
    resetForm()
  }, [selectedStock, preview, resetForm])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(it => it.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    if (items.length === 0) return
    if (!window.confirm(`${items.length}개 항목을 모두 지웁니다. 계속할까요?`)) return
    setItems([])
  }, [items.length])

  const refresh = useCallback(async () => {
    if (refreshing || items.length === 0) return
    setRefreshing(true)
    try {
      const codes = items.map(it => it.code)
      const { prices } = await fetchKisPrices(codes)
      setLivePrices(prev => ({ ...prev, ...prices }))
    } finally {
      setRefreshing(false)
    }
  }, [refreshing, items])

  const summary = useMemo(() => {
    if (items.length === 0) return null
    let totalInvest = 0
    let totalEval = 0
    let evalAvailable = true
    for (const it of items) {
      const cur = livePrices[it.code]?.current_price
      const invest = it.assumedPrice * it.quantity
      totalInvest += invest
      if (cur != null) {
        totalEval += cur * it.quantity
      } else {
        evalAvailable = false
        totalEval += invest
      }
    }
    const profit = totalEval - totalInvest
    const rate = totalInvest > 0 ? (profit / totalInvest) * 100 : 0
    return { totalInvest, totalEval, profit, rate, evalAvailable, count: items.length }
  }, [items, livePrices])

  return (
    <div className="space-y-3">
      <div className="bg-card rounded-lg border border-border p-3 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">종목 추가</div>

        {!selectedStock ? (
          <div className="relative">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="종목명 또는 코드 검색"
                className="w-full px-3 py-2 rounded-lg border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg">
                {searchResults.map(s => (
                  <button
                    key={s.code}
                    onClick={() => selectStock(s.code, s.name)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{s.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between p-2 bg-muted/40 rounded-md">
            <div>
              <span className="font-medium text-sm">{selectedStock.name}</span>
              <span className="ml-2 text-xs text-muted-foreground tabular-nums">{selectedStock.code}</span>
              {kisSearching ? (
                <span className="ml-2 text-xs text-muted-foreground">현재가 조회 중...</span>
              ) : livePrices[selectedStock.code] ? (
                <span className="ml-2 text-xs">
                  현재가 <span className="font-semibold text-foreground">{formatPrice(livePrices[selectedStock.code].current_price)}</span>원
                </span>
              ) : null}
            </div>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground p-1" aria-label="다른 종목 선택">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {selectedStock && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">가정 매수가 (원)</label>
              <input
                type="text"
                inputMode="numeric"
                value={assumedPrice}
                onChange={e => setAssumedPrice(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder={livePrices[selectedStock.code] ? formatPrice(livePrices[selectedStock.code].current_price) : "매수가"}
                className="w-full px-3 py-2 rounded-lg border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">수량 (주)</label>
              <input
                type="text"
                inputMode="numeric"
                value={quantity}
                onChange={e => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="수량"
                className="w-full px-3 py-2 rounded-lg border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        )}

        {preview && (
          <div className="mt-2 p-3 bg-muted/30 rounded-md text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">매수금액</span>
              <span className="font-medium tabular-nums">{formatPrice(preview.invest)}원</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">평가금액</span>
              <span className="font-medium tabular-nums">{formatPrice(preview.evalAmt)}원</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">손익</span>
              <span className={cn("font-semibold tabular-nums", preview.profit >= 0 ? "text-red-500" : "text-blue-500")}>
                {preview.profit >= 0 ? "+" : ""}{formatPrice(preview.profit)}원
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">수익률</span>
              <span className={cn("font-bold tabular-nums px-1.5 py-0.5 rounded text-xs", getChangeBgColor(preview.rate))}>
                {preview.rate >= 0 ? "+" : ""}{preview.rate.toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {preview && (
          <button
            onClick={addItem}
            className="w-full mt-2 px-3 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            누적 리스트에 추가
          </button>
        )}
      </div>

      {summary && (
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">종합 ({summary.count}종목)</span>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="text-muted-foreground hover:text-foreground p-1 disabled:opacity-50"
              aria-label="현재가 새로고침"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">매수</span>{" "}
              <span className="font-medium tabular-nums">{formatPrice(summary.totalInvest)}원</span>
            </div>
            <div>
              <span className="text-muted-foreground">평가</span>{" "}
              <span className="font-medium tabular-nums">{formatPrice(summary.totalEval)}원</span>
            </div>
            <div>
              <span className="text-muted-foreground">손익</span>{" "}
              <span className={cn("font-semibold tabular-nums", summary.profit >= 0 ? "text-red-500" : "text-blue-500")}>
                {summary.profit >= 0 ? "+" : ""}{formatPrice(summary.profit)}원
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">수익률</span>{" "}
              <span className={cn("font-bold tabular-nums px-1.5 py-0.5 rounded", getChangeBgColor(summary.rate))}>
                {summary.rate >= 0 ? "+" : ""}{summary.rate.toFixed(2)}%
              </span>
            </div>
          </div>
          {!summary.evalAvailable && (
            <div className="mt-2 text-[10px] text-muted-foreground">일부 종목 현재가 미수집 — 새로고침</div>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">누적 리스트</span>
            <button onClick={clearAll} className="text-[10px] text-muted-foreground hover:text-destructive">
              전체 지우기
            </button>
          </div>
          <ul className="space-y-2">
            {items.map(it => {
              const cur = livePrices[it.code]?.current_price
              const invest = it.assumedPrice * it.quantity
              const evalAmt = cur != null ? cur * it.quantity : invest
              const profit = evalAmt - invest
              const rate = cur != null ? ((cur - it.assumedPrice) / it.assumedPrice) * 100 : 0
              return (
                <li key={it.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{it.name}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{it.code}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                      {formatPrice(it.assumedPrice)}원 × {it.quantity.toLocaleString()}주
                      {cur != null && (
                        <span className="ml-2">현재가 {formatPrice(cur)}원</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <div className={cn("text-xs font-bold tabular-nums", profit >= 0 ? "text-red-500" : "text-blue-500")}>
                        {profit >= 0 ? "+" : ""}{formatPrice(profit)}원
                      </div>
                      <div className={cn("text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded mt-0.5", getChangeBgColor(rate))}>
                        {rate >= 0 ? "+" : ""}{rate.toFixed(2)}%
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(it.id)}
                      className="text-muted-foreground/50 hover:text-destructive p-1"
                      aria-label="삭제"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {items.length === 0 && !preview && (
        <div className="text-center text-xs text-muted-foreground py-8 bg-muted/20 rounded-lg">
          종목을 검색하여 가정 매수가와 수량을 입력하면<br />수익률을 시뮬레이션할 수 있습니다.
        </div>
      )}
    </div>
  )
}
