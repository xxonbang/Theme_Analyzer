import { useState, useEffect, useCallback } from "react"
import type { VolumeProfileData } from "@/types/stock"

const DATA_URL = import.meta.env.BASE_URL + "data/volume-profile.json"

interface UseVolumeProfileReturn {
  data: VolumeProfileData | null
  refetch: () => Promise<void>
}

export function useVolumeProfile(): UseVolumeProfileReturn {
  const [data, setData] = useState<VolumeProfileData | null>(null)

  const refetch = useCallback(async () => {
    try {
      const response = await fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" })
      if (!response.ok) return
      const json = await response.json()
      setData(json)
    } catch {
      // 파일이 없으면 무시
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, refetch }
}
