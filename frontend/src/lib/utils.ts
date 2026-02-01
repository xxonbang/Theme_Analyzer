import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR")
}

export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(1)}M`
  } else if (volume >= 1_000) {
    return `${Math.floor(volume / 1_000)}K`
  }
  return volume.toString()
}

export function formatChangeRate(rate: number): string {
  const sign = rate > 0 ? "+" : ""
  return `${sign}${rate.toFixed(2)}%`
}

export function getChangeColor(rate: number): string {
  if (rate > 0) return "text-red-500"
  if (rate < 0) return "text-blue-500"
  return "text-muted-foreground"
}

export function getChangeBgColor(rate: number): string {
  if (rate >= 10) return "bg-red-500/10 text-red-500"
  if (rate >= 5) return "bg-red-400/10 text-red-400"
  if (rate > 0) return "bg-red-300/10 text-red-400"
  if (rate <= -10) return "bg-blue-500/10 text-blue-500"
  if (rate <= -5) return "bg-blue-400/10 text-blue-400"
  if (rate < 0) return "bg-blue-300/10 text-blue-400"
  return "bg-muted text-muted-foreground"
}
