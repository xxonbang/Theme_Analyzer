import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase, setAccessToken, STORAGE_KEY } from "@/lib/supabase"
import { ExpireStorage } from "@/lib/expire-storage"

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

/** 비활성 자동 로그아웃 시간 (1시간) */
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000

/** 활동 감지 쓰로틀 간격 (30초) */
const ACTIVITY_THROTTLE_MS = 30 * 1000

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const isAdmin = user?.user_metadata?.role === "admin"

  useEffect(() => {
    ExpireStorage.setAdmin(isAdmin)
  }, [isAdmin])

  // --- 비활성 자동 로그아웃 ---
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(() => {
      setSession(null)
      setUser(null)
      setAccessToken(null)
      ExpireStorage.setAdmin(false)
      localStorage.removeItem(STORAGE_KEY)
      supabase.auth.signOut().catch(() => {})
    }, INACTIVITY_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    if (isAdmin || !user) {
      if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null }
      return
    }
    const handleActivity = () => {
      const now = Date.now()
      if (now - lastActivityRef.current > ACTIVITY_THROTTLE_MS) {
        lastActivityRef.current = now
        resetInactivityTimer()
      }
    }
    const events = ["mousedown", "keydown", "scroll", "touchstart"]
    resetInactivityTimer()
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))
    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity))
      if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null }
    }
  }, [isAdmin, user, resetInactivityTimer])

  // --- 탭 복귀 시 세션 갱신 (백그라운드에서 access_token 만료 대응) ---
  useEffect(() => {
    if (!user || isAdmin) return
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return
      // ExpireStorage 8시간 만료 → 로그아웃
      if (!ExpireStorage.getItem(STORAGE_KEY)) {
        setSession(null)
        setUser(null)
        setAccessToken(null)
        return
      }
      // access_token 갱신 — iOS 백그라운드 복귀 시 getSession() hang 방지 (5초 타임아웃)
      const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 5000))
      Promise.race([
        supabase.auth.getSession().then(({ data: { session } }) => session),
        timeout,
      ]).then((session) => {
        if (session?.user) {
          setAccessToken(session.access_token ?? null)
        } else {
          // 타임아웃 또는 세션 없음 — localStorage에서 폴백
          try {
            const stored = ExpireStorage.getItem(STORAGE_KEY)
            if (stored) {
              const parsed = JSON.parse(stored)
              if (parsed?.access_token) {
                setAccessToken(parsed.access_token)
              }
            }
          } catch { /* ignore */ }
        }
      }).catch(() => {})
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [user, isAdmin])

  // --- 인증 상태 관리 (DB 호출 없음 — publishable key에서 PostgREST 401 방지) ---
  useEffect(() => {
    // 즉시 localStorage에서 세션 복원 + access token 설정
    try {
      const stored = ExpireStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.user) {
          setSession(parsed)
          setUser(parsed.user)
          setAccessToken(parsed.access_token ?? null)
        }
      }
    } catch { /* 파싱 실패 시 로그인 화면 표시 */ }
    setLoading(false)

    // SDK 이벤트 구독
    const authed = { current: false }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") authed.current = true
      if (event === "SIGNED_OUT") return
      if (authed.current && !session?.user) return
      if (session?.user) {
        setSession(session)
        setUser(session.user)
        setAccessToken(session.access_token ?? null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    setSession(null)
    setUser(null)
    setAccessToken(null)
    ExpireStorage.setAdmin(false)
    localStorage.removeItem(STORAGE_KEY)
    supabase.auth.signOut().catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}
