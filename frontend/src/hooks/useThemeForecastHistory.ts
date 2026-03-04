import { useState, useCallback, useMemo } from "react"
import type { HistoryIndex, HistoryEntry, GroupedHistory } from "@/types/history"

const INDEX_URL = import.meta.env.BASE_URL + "data/forecast-history-index.json"

interface UseThemeForecastHistoryReturn {
  index: HistoryIndex | null
  groupedHistory: GroupedHistory[]
  selectedData: any | null
  selectedEntry: HistoryEntry | null
  loading: boolean
  error: string | null
  fetchIndex: () => Promise<void>
  fetchHistoryData: (entry: HistoryEntry) => Promise<void>
  clearSelection: () => void
}

export function useThemeForecastHistory(): UseThemeForecastHistoryReturn {
  const [index, setIndex] = useState<HistoryIndex | null>(null)
  const [selectedData, setSelectedData] = useState<any | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIndex = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(INDEX_URL + "?t=" + Date.now())
      if (!response.ok) {
        if (response.status === 404) {
          setIndex({ updated_at: "", entries: [] })
          return
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const jsonData = await response.json()
      setIndex(jsonData)
    } catch (err) {
      console.error("Failed to fetch forecast history index:", err)
      setIndex({ updated_at: "", entries: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchHistoryData = useCallback(async (entry: HistoryEntry) => {
    setLoading(true)
    setError(null)

    try {
      const url = import.meta.env.BASE_URL + entry.path + "?t=" + Date.now()
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`히스토리 파일을 찾을 수 없습니다 (${response.status})`)
      }
      const jsonData = await response.json()
      setSelectedData(jsonData)
      setSelectedEntry(entry)
    } catch (err) {
      console.error("Failed to fetch forecast history data:", err)
      setError(err instanceof Error ? err.message : "히스토리 데이터를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedData(null)
    setSelectedEntry(null)
    setError(null)
  }, [])

  const groupedHistory = useMemo<GroupedHistory[]>(() => {
    if (!index?.entries) return []

    const groups: Record<string, HistoryEntry[]> = {}

    for (const entry of index.entries) {
      if (!groups[entry.date]) {
        groups[entry.date] = []
      }
      groups[entry.date].push(entry)
    }

    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, entries]) => ({
        date,
        entries: entries.sort((a, b) => b.time.localeCompare(a.time)),
      }))
  }, [index])

  return {
    index,
    groupedHistory,
    selectedData,
    selectedEntry,
    loading,
    error,
    fetchIndex,
    fetchHistoryData,
    clearSelection,
  }
}
