import { useState, useEffect } from "react"

type ThemeMode = "light" | "dark" | "system"

const STORAGE_KEY = "theme-mode"

function getSystemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function applyTheme(mode: ThemeMode) {
  const isDark = mode === "dark" || (mode === "system" && getSystemDark())
  document.documentElement.classList.toggle("dark", isDark)
}

export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    return saved || "system"
  })

  useEffect(() => {
    applyTheme(mode)
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  // 시스템 설정 변경 감지
  useEffect(() => {
    if (mode !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyTheme("system")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [mode])

  const toggle = () => {
    setMode((prev) => {
      if (prev === "system") return getSystemDark() ? "light" : "dark"
      return prev === "dark" ? "light" : "dark"
    })
  }

  const isDark = mode === "dark" || (mode === "system" && getSystemDark())

  return { mode, setMode, toggle, isDark }
}
