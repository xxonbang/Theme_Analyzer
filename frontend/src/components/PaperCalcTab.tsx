import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { X, RefreshCw, Search, Plus, Pencil, Check } from "lucide-react"
import { cn, formatPrice, getChangeBgColor } from "@/lib/utils"
import { fetchKisPrices, searchKisStock, type KisStockPrice } from "@/lib/kis-api"
import {
  fetchPaperCalcState,
  savePaperCalcState,
  type PaperCalcItem,
  type ScenarioTab,
  type PaperCalcState,
} from "@/lib/paper-calc-history"

interface PaperCalcTabProps {
  masterStocks: { code: string; name: string; market: string }[]
}

const STORAGE_KEY = "paper-calc-state"

function createDefaultTab(): ScenarioTab {
  return { id: crypto.randomUUID(), name: "시나리오 1", items: [] }
}

function loadInitialState(): PaperCalcState {
  if (typeof window === "undefined") {
    const t = createDefaultTab()
    return { tabs: [t], activeTabId: t.id }
  }
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as PaperCalcState
      if (parsed.tabs?.length > 0) return parsed
    } catch {}
  }
  // legacy: 단일 items 배열 — 첫 시나리오로 마이그레이션
  const legacy = localStorage.getItem("paper-calc-items")
  if (legacy) {
    try {
      const items = JSON.parse(legacy) as PaperCalcItem[]
      const tab: ScenarioTab = { id: crypto.randomUUID(), name: "시나리오 1", items }
      return { tabs: [tab], activeTabId: tab.id }
    } catch {}
  }
  const t = createDefaultTab()
  return { tabs: [t], activeTabId: t.id }
}

export function PaperCalcTab({ masterStocks }: PaperCalcTabProps) {
  const [state, setState] = useState<PaperCalcState>(loadInitialState)
  const [livePrices, setLivePrices] = useState<Record<string, KisStockPrice>>({})
  const [refreshing, setRefreshing] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStock, setSelectedStock] = useState<{ code: string; name: string } | null>(null)
  const [assumedPrice, setAssumedPrice] = useState("")
  const [quantity, setQuantity] = useState("")
  // 비교 기준: 자동 fetch되는 현재가 vs 사용자가 직접 입력한 목표가
  const [comparisonMode, setComparisonMode] = useState<"current" | "target">("current")
  const [targetPrice, setTargetPrice] = useState("")
  const [kisSearching, setKisSearching] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")

  const hasFetchedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 활성 탭의 items (파생값)
  const activeTab = useMemo(
    () => state.tabs.find(t => t.id === state.activeTabId) ?? state.tabs[0],
    [state]
  )
  const items = activeTab?.items ?? []

  // mount 시 Supabase 동기화 (Supabase가 진실 소스)
  useEffect(() => {
    let cancelled = false
    fetchPaperCalcState().then(server => {
      if (cancelled) return
      if (server !== null) {
        if (server.tabs.length === 0) {
          // 로그인 + 서버 비어있음 → 기본 탭 생성 (다음 save로 서버에도 반영)
          const t = createDefaultTab()
          setState({ tabs: [t], activeTabId: t.id })
        } else {
          const activeId = server.activeTabId && server.tabs.some(t => t.id === server.activeTabId)
            ? server.activeTabId
            : server.tabs[0].id
          setState({ tabs: server.tabs, activeTabId: activeId })
        }
      }
      hasFetchedRef.current = true
    }).catch(() => { hasFetchedRef.current = true })
    return () => { cancelled = true }
  }, [])

  // state 변경 시: localStorage 즉시 + Supabase 500ms debounce upsert
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    if (!hasFetchedRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      savePaperCalcState(state).catch(() => {})
    }, 500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [state])

  // 활성 탭 items의 현재가 보강
  useEffect(() => {
    if (items.length === 0) return
    const codes = items.map(it => it.code).filter(c => !livePrices[c])
    if (codes.length === 0) return
    fetchKisPrices(codes).then(({ prices }) => {
      setLivePrices(prev => ({ ...prev, ...prices }))
    }).catch(() => {})
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  // ============ 활성 탭 items 변경 헬퍼 ============
  const updateActiveTabItems = useCallback((updater: (items: PaperCalcItem[]) => PaperCalcItem[]) => {
    setState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => t.id === prev.activeTabId ? { ...t, items: updater(t.items) } : t),
    }))
  }, [])

  // ============ 시나리오 탭 관리 ============
  const switchTab = useCallback((id: string) => {
    setState(prev => ({ ...prev, activeTabId: id }))
    setEditingTabId(null)
  }, [])

  const addTab = useCallback(() => {
    setState(prev => {
      const nextNum = prev.tabs.length + 1
      const newTab: ScenarioTab = { id: crypto.randomUUID(), name: `시나리오 ${nextNum}`, items: [] }
      return { tabs: [...prev.tabs, newTab], activeTabId: newTab.id }
    })
  }, [])

  const deleteTab = useCallback((id: string) => {
    setState(prev => {
      if (prev.tabs.length <= 1) return prev
      const target = prev.tabs.find(t => t.id === id)
      if (!target) return prev
      const itemCount = target.items.length
      if (itemCount > 0 && !window.confirm(`"${target.name}" 시나리오를 삭제합니다 (${itemCount}개 종목). 계속할까요?`)) {
        return prev
      }
      if (itemCount === 0 && !window.confirm(`"${target.name}" 시나리오를 삭제합니다. 계속할까요?`)) {
        return prev
      }
      const nextTabs = prev.tabs.filter(t => t.id !== id)
      const nextActive = prev.activeTabId === id ? nextTabs[0].id : prev.activeTabId
      return { tabs: nextTabs, activeTabId: nextActive }
    })
  }, [])

  const startEdit = useCallback((tab: ScenarioTab) => {
    setEditingTabId(tab.id)
    setEditingName(tab.name)
  }, [])

  const commitEdit = useCallback(() => {
    if (!editingTabId) return
    const name = editingName.trim()
    if (!name) { setEditingTabId(null); return }
    setState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => t.id === editingTabId ? { ...t, name } : t),
    }))
    setEditingTabId(null)
  }, [editingTabId, editingName])

  const cancelEdit = useCallback(() => {
    setEditingTabId(null)
  }, [])

  // ============ 종목 입력 폼 ============
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
    setComparisonMode("current")
    setTargetPrice("")
    setSearchQuery("")
    searchInputRef.current?.focus()
  }, [])

  const preview = useMemo(() => {
    if (!selectedStock) return null
    const p = parseInt(assumedPrice.replace(/,/g, ""))
    const q = parseInt(quantity.replace(/,/g, ""))
    if (!p || !q || p <= 0 || q <= 0) return null

    // 비교 가격: 모드에 따라 현재가 또는 목표가
    let cur: number
    let isTarget = false
    if (comparisonMode === "target") {
      const t = parseInt(targetPrice.replace(/,/g, ""))
      if (!t || t <= 0) return null  // 목표가 미입력 시 preview 미표시
      cur = t
      isTarget = true
    } else {
      cur = livePrices[selectedStock.code]?.current_price ?? p
    }

    const invest = p * q
    const evalAmt = cur * q
    const profit = evalAmt - invest
    const rate = ((cur - p) / p) * 100
    return { p, q, cur, invest, evalAmt, profit, rate, isTarget }
  }, [selectedStock, assumedPrice, quantity, livePrices, comparisonMode, targetPrice])

  const addItem = useCallback(() => {
    if (!selectedStock || !preview) return
    const newItem: PaperCalcItem = {
      id: crypto.randomUUID(),
      code: selectedStock.code,
      name: selectedStock.name,
      assumedPrice: preview.p,
      quantity: preview.q,
      ...(preview.isTarget ? { targetPrice: preview.cur } : {}),
      addedAt: new Date().toISOString(),
    }
    updateActiveTabItems(prev => [newItem, ...prev])
    resetForm()
  }, [selectedStock, preview, resetForm, updateActiveTabItems])

  const removeItem = useCallback((id: string) => {
    updateActiveTabItems(prev => prev.filter(it => it.id !== id))
  }, [updateActiveTabItems])

  const clearAll = useCallback(() => {
    if (items.length === 0) return
    if (!window.confirm(`${items.length}개 항목을 모두 지웁니다. 계속할까요?`)) return
    updateActiveTabItems(() => [])
  }, [items.length, updateActiveTabItems])

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
      // 목표가 설정된 항목은 그것을, 아니면 현재가 사용
      const cmp = it.targetPrice ?? livePrices[it.code]?.current_price
      const invest = it.assumedPrice * it.quantity
      totalInvest += invest
      if (cmp != null) {
        totalEval += cmp * it.quantity
      } else {
        evalAvailable = false
        totalEval += invest
      }
    }
    const profit = totalEval - totalInvest
    const rate = totalInvest > 0 ? (profit / totalInvest) * 100 : 0
    return { totalInvest, totalEval, profit, rate, evalAvailable, count: items.length }
  }, [items, livePrices])

  const canDelete = state.tabs.length > 1

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
                className="w-full px-3 py-2 rounded-lg border bg-background text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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

        {/* 시나리오 탭 뱃지 */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {state.tabs.map(tab => {
            const isActive = tab.id === state.activeTabId
            const isEditing = editingTabId === tab.id
            if (isEditing) {
              return (
                <div key={tab.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/40 pl-2.5 pr-1 py-0.5">
                  <input
                    autoFocus
                    type="text"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitEdit()
                      else if (e.key === "Escape") cancelEdit()
                    }}
                    onBlur={commitEdit}
                    className="w-24 bg-transparent text-xs font-medium focus:outline-none text-foreground"
                    maxLength={20}
                  />
                  <button
                    onClick={commitEdit}
                    className="p-0.5 rounded-full hover:bg-primary/20 text-primary"
                    aria-label="이름 확정"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              )
            }
            return (
              <div
                key={tab.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full text-xs transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground pl-2.5 pr-1 py-0.5 font-semibold"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground px-2.5 py-1 font-medium",
                )}
              >
                <button
                  onClick={() => switchTab(tab.id)}
                  className="truncate max-w-[140px]"
                  title={`${tab.name} (${tab.items.length}종목)`}
                >
                  {tab.name}
                  {!isActive && tab.items.length > 0 && (
                    <span className="ml-1 text-[10px] tabular-nums opacity-60">
                      {tab.items.length}
                    </span>
                  )}
                </button>
                {isActive && (
                  <>
                    <button
                      onClick={() => startEdit(tab)}
                      className="p-0.5 rounded-full hover:bg-primary-foreground/20"
                      aria-label="이름 변경"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => deleteTab(tab.id)}
                        className="p-0.5 rounded-full hover:bg-primary-foreground/20"
                        aria-label="시나리오 삭제"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          })}
          <button
            onClick={addTab}
            className="inline-flex items-center gap-0.5 rounded-full bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground px-2 py-1 text-xs font-medium transition-colors"
            aria-label="새 시나리오 추가"
          >
            <Plus className="w-3 h-3" />
            <span>새 시나리오</span>
          </button>
        </div>

        {selectedStock && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-medium block">가정 매수가 (원)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={assumedPrice}
                  onChange={e => setAssumedPrice(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder={livePrices[selectedStock.code] ? formatPrice(livePrices[selectedStock.code].current_price) : "매수가"}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-base sm:text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-shadow"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-medium block">수량 (주)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="수량"
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-base sm:text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-shadow"
                />
              </div>
            </div>
            {/* 비교 기준 토글 + 목표가 입력 */}
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-medium block">비교 기준</label>
                <div className="inline-flex w-full bg-muted/40 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setComparisonMode("current")}
                    className={cn(
                      "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors",
                      comparisonMode === "current"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    현재가
                  </button>
                  <button
                    type="button"
                    onClick={() => setComparisonMode("target")}
                    className={cn(
                      "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors",
                      comparisonMode === "target"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    목표가
                  </button>
                </div>
              </div>
              {comparisonMode === "target" ? (
                <div className="space-y-1.5">
                  <label className="text-[11px] text-muted-foreground font-medium block">목표가 (원)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={targetPrice}
                    onChange={e => setTargetPrice(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="도달 가정 가격"
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-base sm:text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-shadow"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-muted-foreground/70 block">자동</div>
                  <div className="w-full px-3 py-2.5 rounded-lg bg-muted/30 border border-border/40 text-sm tabular-nums text-foreground/70">
                    {livePrices[selectedStock.code]
                      ? `${formatPrice(livePrices[selectedStock.code].current_price)}원`
                      : "현재가 조회 중…"}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {preview && (
          <div className="mt-3 p-3.5 bg-muted/40 rounded-lg space-y-2">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
              <span className="text-muted-foreground/80">매수금액</span>
              <span className="text-right font-medium tabular-nums text-foreground/90">{formatPrice(preview.invest)}원</span>
              <span className="text-muted-foreground/80">
                {preview.isTarget ? "목표 평가금액" : "평가금액"}
              </span>
              <span className="text-right font-medium tabular-nums text-foreground/90">{formatPrice(preview.evalAmt)}원</span>
              <span className="text-muted-foreground/80">손익</span>
              <span className={cn("text-right font-semibold tabular-nums", preview.profit >= 0 ? "text-red-500" : "text-blue-500")}>
                {preview.profit >= 0 ? "+" : ""}{formatPrice(preview.profit)}원
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span className="text-[13px] text-muted-foreground/80">
                {preview.isTarget ? "목표가 도달 시 수익률" : "수익률"}
              </span>
              <span className={cn("font-bold tabular-nums px-2.5 py-1 rounded-md text-sm", getChangeBgColor(preview.rate))}>
                {preview.rate >= 0 ? "+" : ""}{preview.rate.toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {preview && (
          <button
            onClick={addItem}
            className="w-full mt-3 px-3 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            누적 리스트에 추가
          </button>
        )}
      </div>

      {summary && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">종합 · {summary.count}종목</span>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="text-muted-foreground hover:text-foreground p-1 disabled:opacity-50 transition-colors"
              aria-label="현재가 새로고침"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            </button>
          </div>
          {/* 메인 KPI: 수익률 + 손익 */}
          <div className="flex items-baseline justify-between mb-3 pb-3 border-b border-border/40">
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">수익률</div>
              <div className={cn("text-2xl font-bold tabular-nums leading-none", summary.rate >= 0 ? "text-red-500" : "text-blue-500")}>
                {summary.rate >= 0 ? "+" : ""}{summary.rate.toFixed(2)}<span className="text-base ml-0.5">%</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground mb-1">손익</div>
              <div className={cn("text-base font-semibold tabular-nums", summary.profit >= 0 ? "text-red-500" : "text-blue-500")}>
                {summary.profit >= 0 ? "+" : ""}{formatPrice(summary.profit)}원
              </div>
            </div>
          </div>
          {/* 보조: 매수·평가 */}
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div className="space-y-0.5">
              <div className="text-muted-foreground">매수</div>
              <div className="font-medium tabular-nums text-foreground/85">{formatPrice(summary.totalInvest)}원</div>
            </div>
            <div className="space-y-0.5 text-right">
              <div className="text-muted-foreground">평가</div>
              <div className="font-medium tabular-nums text-foreground/85">{formatPrice(summary.totalEval)}원</div>
            </div>
          </div>
          {!summary.evalAvailable && (
            <div className="mt-3 text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-amber-500" />
              일부 종목 현재가 미수집 — 새로고침
            </div>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">누적 리스트</span>
            <button onClick={clearAll} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">
              전체 지우기
            </button>
          </div>
          <ul className="divide-y divide-border/40">
            {items.map(it => {
              const live = livePrices[it.code]?.current_price
              const cmp = it.targetPrice ?? live
              const invest = it.assumedPrice * it.quantity
              const evalAmt = cmp != null ? cmp * it.quantity : invest
              const profit = evalAmt - invest
              const rate = cmp != null ? ((cmp - it.assumedPrice) / it.assumedPrice) * 100 : 0
              const isTarget = it.targetPrice != null
              return (
                <li key={it.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm truncate text-foreground">{it.name}</span>
                      <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0">{it.code}</span>
                      {isTarget && (
                        <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">목표</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums flex flex-wrap gap-x-2">
                      <span className="whitespace-nowrap">
                        <span className="font-medium text-foreground/70">{formatPrice(it.assumedPrice)}</span>원 × {it.quantity.toLocaleString()}주
                      </span>
                      {isTarget ? (
                        <span className="whitespace-nowrap text-amber-600 dark:text-amber-400">목표 {formatPrice(it.targetPrice!)}원</span>
                      ) : live != null ? (
                        <span className="whitespace-nowrap text-muted-foreground/60">현재 {formatPrice(live)}원</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className={cn("text-[13px] font-bold tabular-nums leading-tight", profit >= 0 ? "text-red-500" : "text-blue-500")}>
                      {profit >= 0 ? "+" : ""}{formatPrice(profit)}원
                    </div>
                    <div className={cn("inline-block text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded leading-tight", getChangeBgColor(rate))}>
                      {rate >= 0 ? "+" : ""}{rate.toFixed(2)}%
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(it.id)}
                    className="text-muted-foreground/40 hover:text-destructive p-1.5 shrink-0 transition-colors"
                    aria-label="삭제"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
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
