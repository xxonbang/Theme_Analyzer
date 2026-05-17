const STORAGE_KEY = "recent-stock-searches"
const MAX_ITEMS = 10

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(c => typeof c === "string") : []
  } catch {
    return []
  }
}

export function addRecentSearch(code: string): string[] {
  if (!code) return getRecentSearches()
  const current = getRecentSearches().filter(c => c !== code)
  const next = [code, ...current].slice(0, MAX_ITEMS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function removeRecentSearch(code: string): string[] {
  const next = getRecentSearches().filter(c => c !== code)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function clearRecentSearches(): void {
  localStorage.removeItem(STORAGE_KEY)
}
