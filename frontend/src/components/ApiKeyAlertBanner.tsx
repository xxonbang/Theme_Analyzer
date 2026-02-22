import { cn } from "@/lib/utils"
import type { ApiAlert } from "@/hooks/useApiAlerts"

interface ApiKeyAlertBannerProps {
  alerts: ApiAlert[]
}

export function ApiKeyAlertBanner({ alerts }: ApiKeyAlertBannerProps) {
  if (alerts.length === 0) return null

  return (
    <div
      className={cn(
        "mb-4 sm:mb-6 border rounded-lg px-3 py-2 sm:px-4 sm:py-2.5",
        "bg-red-50 border-red-200 text-red-700"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm sm:text-base">🔑</span>
        <span className="font-medium text-xs sm:text-sm">
          API Key 오류 감지 ({alerts.length}건)
        </span>
      </div>
      <ul className="space-y-0.5">
        {alerts.map((alert) => (
          <li key={alert.id} className="text-[10px] sm:text-xs opacity-80">
            <span className="font-semibold">{alert.service_name}</span>
            {" — "}
            {alert.error_type}
            {alert.error_message && `: ${alert.error_message.slice(0, 80)}`}
          </li>
        ))}
      </ul>
    </div>
  )
}
