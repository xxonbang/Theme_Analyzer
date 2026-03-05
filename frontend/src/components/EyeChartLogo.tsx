import { cn } from "@/lib/utils"

interface EyeChartLogoProps {
  className?: string
}

export function EyeChartLogo({ className }: EyeChartLogoProps) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo.png`}
      alt="Theme Analyzer"
      className={cn("w-5 h-5 object-contain", className)}
    />
  )
}
