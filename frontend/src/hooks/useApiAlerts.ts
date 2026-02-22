import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export interface ApiAlert {
  id: string
  service_name: string
  error_type: string
  error_message: string | null
  detected_at: string
}

export function useApiAlerts(isAdmin: boolean) {
  const [alerts, setAlerts] = useState<ApiAlert[]>([])

  useEffect(() => {
    if (!isAdmin) return

    const fetchAlerts = async () => {
      const { data, error } = await supabase
        .from("api_key_alerts")
        .select("id, service_name, error_type, error_message, detected_at")
        .is("resolved_at", null)
        .order("detected_at", { ascending: false })

      if (!error && data) {
        setAlerts(data)
      }
    }

    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000) // 5분마다 폴링
    return () => clearInterval(interval)
  }, [isAdmin])

  return alerts
}
