import { createClient } from "@supabase/supabase-js"
import { ExpireStorage } from "./expire-storage"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set in .env.local")
}

// 모듈 레벨 access token — onAuthStateChange에서 직접 설정
let _accessToken: string | null = null
export function setAccessToken(token: string | null) { _accessToken = token }
export function getAccessToken() { return _accessToken }

export const STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpireStorage,
    autoRefreshToken: true,
    persistSession: true,
    lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => await fn(),
  },
  global: {
    fetch: (url, options = {}) => {
      const urlStr = typeof url === "string" ? url : url instanceof Request ? url.url : ""
      if ((urlStr.includes("/rest/v1/") || urlStr.includes("/functions/v1/")) && _accessToken) {
        const headers = new Headers(options?.headers)
        headers.set("Authorization", `Bearer ${_accessToken}`)
        options = { ...options, headers }
      }
      return fetch(url, options)
    },
  },
})
