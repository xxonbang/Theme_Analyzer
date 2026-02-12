# Supabase 세션 관리 + 사용자 활동 로그 구현 가이드

Supabase Free Plan 환경에서 React (TypeScript) 프론트엔드 기반으로 구현하는 방법.

## 목차

1. [세션 관리 개요](#1-세션-관리-개요)
2. [ExpireStorage — 절대 세션 시간 제한](#2-expirestorage--절대-세션-시간-제한)
3. [Supabase Client 설정](#3-supabase-client-설정)
4. [Inactivity Timer — 비활성 자동 로그아웃](#4-inactivity-timer--비활성-자동-로그아웃)
5. [탭 복귀 시 세션 확인](#5-탭-복귀-시-세션-확인)
6. [역할 기반 면제 (Admin 영구 로그인)](#6-역할-기반-면제-admin-영구-로그인)
7. [사용자 방문 이력 (user_history)](#7-사용자-방문-이력-user_history)
8. [사용자 활동 로그 (user_activity_log)](#8-사용자-활동-로그-user_activity_log)
9. [Auth Provider 전체 구조](#9-auth-provider-전체-구조)
10. [설정값 커스터마이징](#10-설정값-커스터마이징)
11. [체크리스트](#11-체크리스트)

---

## 1. 세션 관리 개요

### 배경

Supabase Free Plan에서는 대시보드에서 Refresh Token 유효기간이나 세션 비활성 타임아웃을 설정할 수 없다 (Pro Plan 이상 필요). 기본 동작은 `autoRefreshToken: true`로 인해 토큰이 무한 갱신되어 사실상 영구 로그인 상태가 된다.

### 해결 방식

두 가지 메커니즘을 조합한다:

| 메커니즘 | 역할 | 동작 |
|---------|------|------|
| **ExpireStorage** | 절대 세션 시간 제한 | localStorage에 만료 타임스탬프 저장, 만료 시 세션 데이터 반환 거부 |
| **Inactivity Timer** | 비활성 자동 로그아웃 | 사용자 입력 이벤트 감지, 일정 시간 무활동 시 signOut() 호출 |

### 왜 두 가지 모두 필요한가?

- **ExpireStorage만**: 사용자가 탭을 열어두고 계속 활동하면 토큰 자동 갱신이 유지됨. 비활성 상태를 감지할 수 없음.
- **Inactivity Timer만**: 브라우저가 백그라운드 탭에서 setTimeout을 지연/중단할 수 있어, 탭을 닫았다가 다시 열면 타이머가 작동하지 않을 수 있음.
- **두 가지 조합**: ExpireStorage가 storage 레벨에서 세션 데이터를 만료시키고, Inactivity Timer가 활성 탭에서의 유휴 상태를 감지하여 자동 로그아웃. 탭 복귀 시 `visibilitychange` 이벤트로 만료 여부 재확인.

---

## 2. ExpireStorage — 절대 세션 시간 제한

Supabase `createClient`의 `auth.storage` 옵션에 전달할 커스텀 storage 객체. localStorage를 래핑하여 각 항목에 만료 타임스탬프를 추가한다.

### 파일 생성: `lib/expire-storage.ts`

```typescript
/** 절대 세션 유효 시간 */
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8시간

/** 래핑 형식 식별용 마커 */
const EXPIRE_MARKER = "__expire__"

/** 만료 면제 플래그 localStorage 키 */
const EXEMPT_FLAG_KEY = "__session_exempt__"

interface WrappedItem {
  value: string
  [EXPIRE_MARKER]: number
}

function isWrappedItem(obj: unknown): obj is WrappedItem {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "value" in obj &&
    EXPIRE_MARKER in (obj as Record<string, unknown>)
  )
}

export const ExpireStorage = {
  /** 만료 면제 설정 (예: admin 사용자) */
  setExempt(exempt: boolean): void {
    if (exempt) {
      localStorage.setItem(EXEMPT_FLAG_KEY, "1")
    } else {
      localStorage.removeItem(EXEMPT_FLAG_KEY)
    }
  },

  /** 만료 면제 여부 확인 */
  isExempt(): boolean {
    return localStorage.getItem(EXEMPT_FLAG_KEY) === "1"
  },

  getItem(key: string): string | null {
    const raw = localStorage.getItem(key)
    if (raw === null) return null

    try {
      const parsed: unknown = JSON.parse(raw)

      if (isWrappedItem(parsed)) {
        // 면제 사용자는 만료 무시
        if (this.isExempt()) return parsed.value

        // 만료 확인
        if (Date.now() > parsed[EXPIRE_MARKER]) {
          localStorage.removeItem(key)
          return null // → Supabase가 세션 없음으로 인식
        }

        return parsed.value
      }
    } catch {
      // JSON 파싱 실패 → 래핑되지 않은 기존 데이터
    }

    return raw
  },

  setItem(key: string, value: string): void {
    const item: WrappedItem = {
      value,
      [EXPIRE_MARKER]: Date.now() + SESSION_DURATION_MS,
    }
    localStorage.setItem(key, JSON.stringify(item))
  },

  removeItem(key: string): void {
    localStorage.removeItem(key)
  },
}
```

### 동작 원리

1. Supabase가 세션 토큰을 저장할 때 → `setItem` 호출 → 실제 값 + 만료 타임스탬프 저장
2. Supabase가 세션을 읽을 때 → `getItem` 호출 → 만료 시간 경과 시 `null` 반환
3. Supabase가 `null`을 받으면 "세션 없음"으로 인식 → 로그아웃 상태
4. 면제 사용자(`isExempt() === true`)는 만료 확인을 건너뜀

---

## 3. Supabase Client 설정

### 파일 수정: `lib/supabase.ts`

```typescript
import { createClient } from "@supabase/supabase-js"
import { ExpireStorage } from "./expire-storage"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpireStorage,       // 커스텀 storage
    autoRefreshToken: true,       // 토큰 자동 갱신 유지
    persistSession: true,         // 세션 localStorage 저장
  },
})
```

---

## 4. Inactivity Timer — 비활성 자동 로그아웃

Auth Provider 내부에서 사용자 활동을 감지하고, 일정 시간 무활동 시 자동 로그아웃한다.

```typescript
/** 비활성 자동 로그아웃 시간 */
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000 // 1시간

/** 활동 감지 쓰로틀 간격 */
const ACTIVITY_THROTTLE_MS = 30 * 1000 // 30초

// --- Auth Provider 내부 ---

const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const lastActivityRef = useRef<number>(Date.now())

// 타이머 리셋
const resetInactivityTimer = useCallback(() => {
  if (inactivityTimerRef.current) {
    clearTimeout(inactivityTimerRef.current)
  }
  inactivityTimerRef.current = setTimeout(() => {
    supabase.auth.signOut()
  }, INACTIVITY_TIMEOUT_MS)
}, [])

// 활동 감지 + 타이머 관리
useEffect(() => {
  // 면제 사용자이거나 비로그인 상태면 타이머 불필요
  if (isExempt || !user) {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
    return
  }

  const handleActivity = () => {
    const now = Date.now()
    // 쓰로틀: 일정 간격마다 한 번만 리셋 (성능 보호)
    if (now - lastActivityRef.current > ACTIVITY_THROTTLE_MS) {
      lastActivityRef.current = now
      resetInactivityTimer()
    }
  }

  const events = ["mousedown", "keydown", "scroll", "touchstart"]

  // 초기 타이머 시작
  resetInactivityTimer()

  events.forEach(event =>
    window.addEventListener(event, handleActivity, { passive: true }),
  )

  return () => {
    events.forEach(event => window.removeEventListener(event, handleActivity))
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
  }
}, [isExempt, user, resetInactivityTimer])
```

### 설계 포인트

- **쓰로틀**: `mousedown`, `scroll` 등은 초당 수십~수백 회 발생할 수 있으므로, 30초 간격으로 쓰로틀하여 성능을 보호한다.
- **면제 사용자**: admin 등 면제 대상은 타이머를 설정하지 않는다.
- **클린업**: 컴포넌트 언마운트 시 이벤트 리스너와 타이머를 정리한다.

---

## 5. 탭 복귀 시 세션 확인

브라우저가 백그라운드 탭에서 setTimeout을 지연시킬 수 있으므로, 탭 복귀 시 세션 유효성을 재확인한다.

```typescript
useEffect(() => {
  if (!user || isExempt) return

  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      // ExpireStorage의 getItem이 만료를 판단
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setSession(null)
          setUser(null)
        }
      })
    }
  }

  document.addEventListener("visibilitychange", handleVisibility)
  return () => document.removeEventListener("visibilitychange", handleVisibility)
}, [user, isExempt])
```

---

## 6. 역할 기반 면제 (Admin 영구 로그인)

특정 역할(예: admin)은 세션 만료와 비활성 타이머를 모두 면제한다.

### 면제 판단

```typescript
// Supabase user_metadata에서 역할 확인
const isExempt = user?.user_metadata?.role === "admin"
```

### ExpireStorage와 동기화

```typescript
// 역할 상태가 변경될 때 ExpireStorage에 동기화
useEffect(() => {
  ExpireStorage.setExempt(isExempt)
}, [isExempt])

// 로그아웃 시 면제 해제
// onAuthStateChange 콜백 내:
if (event === "SIGNED_OUT") {
  ExpireStorage.setExempt(false)
}
```

### 동작 요약

| 사용자 | ExpireStorage | Inactivity Timer | 결과 |
|--------|--------------|-----------------|------|
| 일반 사용자 | 8시간 후 만료 | 1시간 무활동 시 로그아웃 | 최대 8시간, 비활성 1시간 |
| 면제 사용자 | 만료 우회 | 타이머 미적용 | 영구 로그인 유지 |

### Supabase에서 역할 설정 방법

**방법 A** — Dashboard UI:

Supabase Dashboard → Authentication → Users → 사용자 선택 → Edit User Metadata:

```json
{
  "role": "admin"
}
```

**방법 B** — SQL:

```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'admin@example.com';
```

---

## 7. 사용자 방문 이력 (user_history)

사용자별 "마지막 접속 시각"을 시스템별로 기록한다. upsert 방식으로 항상 1행만 유지.

### 테이블 생성

```sql
CREATE TABLE user_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  email text NOT NULL DEFAULT '',
  system_name text NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, system_name)
);

ALTER TABLE user_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can upsert own history"
  ON user_history FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 구현

```typescript
const SYSTEM_NAME = "MyApp" // 시스템 식별자 (프로젝트별로 변경)

function recordUserHistory(user: User) {
  supabase
    .from("user_history")
    .upsert(
      {
        user_id: user.id,
        email: user.email ?? "",
        system_name: SYSTEM_NAME,
        accessed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,system_name" },
    )
    .then(({ error }) => {
      if (error) console.error("Failed to record user history:", error.message)
    })
}
```

### 호출 시점

```typescript
// 1) 앱 로드 시 (기존 세션 복원)
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) recordUserHistory(session.user)
})

// 2) 로그인 시
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session?.user) {
    recordUserHistory(session.user)
  }
})

// 3) 앱 내 페이지 전환 시 (SPA)
// context에 recordVisit을 노출하여 페이지 전환 시 호출
const recordVisit = useCallback(() => {
  if (user) recordUserHistory(user)
}, [user])
```

### 조회 예시

```sql
-- 시스템별 최근 접속 사용자
SELECT email, system_name, accessed_at
FROM user_history
ORDER BY accessed_at DESC;
```

---

## 8. 사용자 활동 로그 (user_activity_log)

사용자의 상세 활동(로그인, 페이지 전환, 탭 전환, 기능 사용 등)을 누적 기록한다.

### 테이블 생성

```sql
CREATE TABLE user_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  email text NOT NULL DEFAULT '',
  system_name text NOT NULL,
  action_type text NOT NULL,
  action_detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_user_system ON user_activity_log(user_id, system_name);
CREATE INDEX idx_activity_log_created_at ON user_activity_log(created_at DESC);

ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own activity"
  ON user_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

### 추적 이벤트 설계

아래는 예시이며, 프로젝트에 맞게 action_type과 action_detail을 자유롭게 정의한다.

| action_type | action_detail 예시 | 설명 |
|------------|-------------------|------|
| `login` | `{}` | 로그인 |
| `logout` | `{}` | 로그아웃 |
| `page_view` | `{"page": "dashboard"}` | 페이지 접속/전환 |
| `tab_switch` | `{"tab": "settings"}` | 탭 전환 |
| `mode_change` | `{"mode": "dark"}` | 설정/모드 변경 |
| `feature_use` | `{"feature": "export"}` | 특정 기능 사용 |
| `data_refresh` | `{}` | 수동 데이터 갱신 |

### 구현 패턴

#### 1) 헬퍼 함수 (Auth Provider 외부)

```typescript
function insertActivityLog(
  userId: string,
  email: string,
  actionType: string,
  actionDetail?: Record<string, string>,
) {
  supabase
    .from("user_activity_log")
    .insert({
      user_id: userId,
      email,
      system_name: SYSTEM_NAME,
      action_type: actionType,
      action_detail: actionDetail ?? {},
    })
    .then(({ error }) => {
      if (error) console.error("Failed to log activity:", error.message)
    })
}
```

#### 2) Context에 logActivity 노출

Auth Provider 내부에서 현재 사용자 기반의 간편 호출 함수를 만들어 context에 추가한다.

```typescript
const logActivity = useCallback(
  (actionType: string, actionDetail?: Record<string, string>) => {
    if (user) insertActivityLog(user.id, user.email ?? "", actionType, actionDetail)
  },
  [user],
)
```

#### 3) 로그인/로그아웃 추적

로그인은 `onAuthStateChange`에서, 로그아웃은 `signOut` 함수에서 직접 호출한다.
(context의 `logActivity`는 user 상태 의존이므로, 로그인/로그아웃 시점에는 헬퍼 함수를 직접 사용.)

```typescript
// 로그인 — onAuthStateChange 콜백 내
if (event === "SIGNED_IN" && session?.user) {
  insertActivityLog(session.user.id, session.user.email ?? "", "login")
}

// 로그아웃 — signOut 함수 내 (signOut 호출 전에 기록)
const signOut = async () => {
  if (user) {
    insertActivityLog(user.id, user.email ?? "", "logout")
  }
  await supabase.auth.signOut()
}
```

#### 4) 페이지 전환 추적

`useEffect`로 페이지 상태를 감시하여, 마운트 시(최초 접속)와 전환 시 모두 기록한다.

```typescript
useEffect(() => {
  logActivity("page_view", { page: currentPage })
}, [currentPage, logActivity])
```

#### 5) 탭/모드 전환 추적

state setter를 직접 전달하지 않고, 핸들러로 래핑하여 사용자 조작 시에만 기록한다.
(useEffect로 state를 감시하면 localStorage 복원 등 의도하지 않은 시점에도 기록됨.)

```typescript
// Before (로그 없음):
onTabChange={setActiveTab}

// After (로그 추가):
const handleTabChange = useCallback((tab: string) => {
  setActiveTab(tab)
  logActivity("tab_switch", { tab })
}, [logActivity])

onTabChange={handleTabChange}
```

#### 6) 기타 이벤트 추적

기능 사용 시점에 `logActivity`를 직접 호출한다.

```typescript
const handleExport = () => {
  doExport()
  logActivity("feature_use", { feature: "export" })
}

const handleRefresh = useCallback(() => {
  refreshData()
  logActivity("data_refresh")
}, [refreshData, logActivity])
```

### 데이터 조회

```sql
-- 최근 활동 100건
SELECT email, action_type, action_detail, created_at
FROM user_activity_log
ORDER BY created_at DESC
LIMIT 100;

-- 사용자별 활동 요약
SELECT email, action_type, COUNT(*) as count, MAX(created_at) as last_at
FROM user_activity_log
GROUP BY email, action_type
ORDER BY email, count DESC;

-- 일별 활성 사용자 수 (DAU)
SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as dau
FROM user_activity_log
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 특정 기능 사용 빈도
SELECT action_detail->>'feature' as feature, COUNT(*)
FROM user_activity_log
WHERE action_type = 'feature_use'
GROUP BY feature
ORDER BY COUNT(*) DESC;
```

### 데이터 정리

로그가 누적되면 오래된 데이터를 주기적으로 정리한다.

```sql
-- 90일 이전 로그 삭제
DELETE FROM user_activity_log
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## 9. Auth Provider 전체 구조

위의 모든 기능을 통합한 Auth Provider의 전체 구조. 실제 구현 시 참고용.

```typescript
import {
  createContext, useContext, useEffect, useState,
  useRef, useCallback, type ReactNode,
} from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { ExpireStorage } from "@/lib/expire-storage"

// ─── 설정 ───
const SYSTEM_NAME = "MyApp"
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000
const ACTIVITY_THROTTLE_MS = 30 * 1000

// ─── Context 타입 ───
interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  recordVisit: () => void
  logActivity: (actionType: string, actionDetail?: Record<string, string>) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// ─── 헬퍼 함수 (Provider 외부) ───
function recordUserHistory(user: User) {
  supabase
    .from("user_history")
    .upsert(
      {
        user_id: user.id,
        email: user.email ?? "",
        system_name: SYSTEM_NAME,
        accessed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,system_name" },
    )
    .then(({ error }) => {
      if (error) console.error("Failed to record user history:", error.message)
    })
}

function insertActivityLog(
  userId: string,
  email: string,
  actionType: string,
  actionDetail?: Record<string, string>,
) {
  supabase
    .from("user_activity_log")
    .insert({
      user_id: userId,
      email,
      system_name: SYSTEM_NAME,
      action_type: actionType,
      action_detail: actionDetail ?? {},
    })
    .then(({ error }) => {
      if (error) console.error("Failed to log activity:", error.message)
    })
}

// ─── Provider ───
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const isAdmin = user?.user_metadata?.role === "admin"

  // ── 면제 동기화 ──
  useEffect(() => {
    ExpireStorage.setExempt(isAdmin)
  }, [isAdmin])

  // ── 비활성 타이머 ──
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(() => {
      supabase.auth.signOut()
    }, INACTIVITY_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    if (isAdmin || !user) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
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
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
    }
  }, [isAdmin, user, resetInactivityTimer])

  // ── 탭 복귀 세션 확인 ──
  useEffect(() => {
    if (!user || isAdmin) return
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) { setSession(null); setUser(null) }
        })
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [user, isAdmin])

  // ── 세션 초기화 + 구독 ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) recordUserHistory(session.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (event === "SIGNED_IN" && session?.user) {
        recordUserHistory(session.user)
        insertActivityLog(session.user.id, session.user.email ?? "", "login")
      }
      if (event === "SIGNED_OUT") {
        ExpireStorage.setExempt(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Auth 함수 ──
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error ? error.message : null }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }

  const signOut = async () => {
    if (user) insertActivityLog(user.id, user.email ?? "", "logout")
    await supabase.auth.signOut()
  }

  // ── 외부 호출용 함수 ──
  const recordVisit = useCallback(() => {
    if (user) recordUserHistory(user)
  }, [user])

  const logActivity = useCallback(
    (actionType: string, actionDetail?: Record<string, string>) => {
      if (user) insertActivityLog(user.id, user.email ?? "", actionType, actionDetail)
    },
    [user],
  )

  return (
    <AuthContext.Provider value={{
      user, session, loading, isAdmin,
      signUp, signIn, signOut,
      recordVisit, logActivity,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}
```

---

## 10. 설정값 커스터마이징

| 상수 | 기본값 | 설명 |
|------|-------|------|
| `SESSION_DURATION_MS` | 8시간 | 절대 세션 유효 시간. 로그인 후 이 시간이 지나면 세션 만료. |
| `INACTIVITY_TIMEOUT_MS` | 1시간 | 비활성 자동 로그아웃 시간. 사용자 활동 없이 이 시간 경과 시 로그아웃. |
| `ACTIVITY_THROTTLE_MS` | 30초 | 활동 감지 쓰로틀. 이벤트 핸들러 과다 호출 방지. |
| `EXEMPT_FLAG_KEY` | `__session_exempt__` | 면제 플래그 localStorage 키. |
| `SYSTEM_NAME` | `"MyApp"` | 시스템 식별자. 여러 시스템이 같은 Supabase를 공유할 때 구분용. |

---

## 11. 체크리스트

### 세션 관리

- [ ] `expire-storage.ts` 파일 생성
- [ ] Supabase `createClient`에 `auth.storage: ExpireStorage` 설정
- [ ] Auth Provider에 비활성 타이머 추가
- [ ] 탭 복귀 시 `visibilitychange` 핸들러 추가
- [ ] 역할 기반 면제 로직 추가 (`setExempt` + 타이머 스킵)
- [ ] 로그아웃 시 `setExempt(false)` 호출

### 방문 이력

- [ ] `user_history` 테이블 생성 + RLS 정책
- [ ] `recordUserHistory` 함수 구현
- [ ] 앱 로드 시 / 로그인 시 / 페이지 전환 시 호출

### 활동 로그

- [ ] `user_activity_log` 테이블 생성 + RLS 정책
- [ ] `insertActivityLog` 헬퍼 함수 구현
- [ ] Auth Context에 `logActivity` 노출
- [ ] 로그인/로그아웃 이벤트 추적
- [ ] 페이지 전환 추적 (`useEffect` + page 상태)
- [ ] 탭/모드 전환 추적 (핸들러 래핑)
- [ ] 기타 기능 사용 추적 (필요에 따라 추가)
