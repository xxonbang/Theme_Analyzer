import { createClient } from "@supabase/supabase-js"
import { ExpireStorage } from "./expire-storage"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set in .env.local")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpireStorage,
    autoRefreshToken: true,
    persistSession: true,
    // navigator.locks 비활성화 — 강제 새로고침 시 이전 lock 미해제로 모든 auth 메서드 hang 방지
    lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => await fn(),
  },
})
