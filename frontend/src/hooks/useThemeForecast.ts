import { useState, useEffect, useCallback } from "react"
import type { ThemeForecast } from "@/types/stock"

const FORECAST_URL = import.meta.env.BASE_URL + "data/theme-forecast.json"

interface UseThemeForecastReturn {
  data: ThemeForecast | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useThemeForecast(): UseThemeForecastReturn {
  const [data, setData] = useState<ThemeForecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(FORECAST_URL + "?t=" + Date.now(), { cache: "no-store" })
      if (!response.ok) {
        if (response.status === 404) {
          // 아직 예측 데이터가 없는 경우
          setData(null)
          return
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const jsonData = await response.json()
      setData(jsonData)
    } catch (err) {
      console.error("Failed to fetch theme forecast:", err)
      setError("예측 데이터를 불러오는데 실패했습니다.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
