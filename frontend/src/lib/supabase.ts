import { createClient } from "@supabase/supabase-js"
import { ExpireStorage } from "./expire-storage"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set in .env.local")
}

const STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpireStorage,
    autoRefreshToken: true,
    persistSession: true,
    // navigator.locks 비활성화 — 강제 새로고침 시 lock hang 방지
    lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => await fn(),
  },
  global: {
    // PostgREST/Edge Functions 요청에 localStorage의 user JWT 직접 주입
    // (SDK가 publishable key를 Authorization에 넣는 문제 우회)
    fetch: (url, options = {}) => {
      const urlStr = typeof url === "string" ? url : url instanceof Request ? url.url : ""
      if (urlStr.includes("/rest/v1/")) {
        try {
          const stored = ExpireStorage.getItem(STORAGE_KEY)
          if (stored) {
            const session = JSON.parse(stored)
            if (session?.access_token) {
              const headers = new Headers(options?.headers)
              headers.set("Authorization", `Bearer ${session.access_token}`)
              options = { ...options, headers }
            }
          }
        } catch { /* fallback to default */ }
      }
      return fetch(url, options)
    },
  },
})
