import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443"

interface KisCredentials {
  appKey: string
  appSecret: string
  accessToken: string
}

async function getKisCredentials(supabaseServiceClient: ReturnType<typeof createClient>): Promise<KisCredentials> {
  const { data, error } = await supabaseServiceClient
    .from("api_credentials")
    .select("credential_type, credential_value, expires_at")
    .eq("service_name", "kis")
    .eq("is_active", true)

  if (error || !data) throw new Error("KIS credentials not found")

  const creds: Record<string, string> = {}
  let tokenData: { access_token?: string } = {}

  for (const row of data) {
    if (row.credential_type === "access_token") {
      try {
        tokenData = JSON.parse(row.credential_value)
      } catch {
        tokenData = {}
      }
    } else {
      creds[row.credential_type] = row.credential_value
    }
  }

  if (!creds.app_key || !creds.app_secret) {
    throw new Error("KIS app_key or app_secret missing")
  }
  if (!tokenData.access_token) {
    throw new Error("KIS access_token missing — run Python backend first to issue token")
  }

  return {
    appKey: creds.app_key,
    appSecret: creds.app_secret,
    accessToken: tokenData.access_token,
  }
}

function kisHeaders(creds: KisCredentials, trId: string): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "authorization": `Bearer ${creds.accessToken}`,
    "appkey": creds.appKey,
    "appsecret": creds.appSecret,
    "tr_id": trId,
    "custtype": "P",
  }
}

async function fetchStockPrice(creds: KisCredentials, code: string): Promise<{ price: Record<string, unknown> | null; errorMsg: string | null }> {
  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}`
  const res = await fetch(url, { headers: kisHeaders(creds, "FHKST01010100") })
  const data = await res.json()

  if (data.rt_cd !== "0") {
    return { price: null, errorMsg: data.msg1 || `rt_cd=${data.rt_cd}` }
  }

  const o = data.output
  return {
    price: {
      code,
      name: o.hts_kor_isnm || "",
      current_price: parseInt(o.stck_prpr) || 0,
      change_rate: parseFloat(o.prdy_ctrt) || 0,
      change_amount: parseInt(o.prdy_vrss) || 0,
      volume: parseInt(o.acml_vol) || 0,
      market_cap: parseInt(o.hts_avls) || 0,  // 시가총액(억)
      w52_hgpr: parseInt(o.stck_dryy_hgpr) || 0,
      w52_lwpr: parseInt(o.stck_dryy_lwpr) || 0,
      per: parseFloat(o.per) || 0,
      pbr: parseFloat(o.pbr) || 0,
    },
    errorMsg: null,
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Verify caller identity (Authorization header or apikey header)
    const authHeader = req.headers.get("Authorization")
    const apiKey = req.headers.get("apikey")
    if (!authHeader && !apiKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    // Parse request
    const body = await req.json()
    const action = body.action as string
    const codes = (body.codes as string[]) || []

    // Service client for reading KIS credentials
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
    const creds = await getKisCredentials(serviceClient)

    let result: Record<string, unknown> = {}

    if (action === "prices" && codes.length > 0) {
      // Bulk price lookup (max 20 codes per request)
      const limited = codes.slice(0, 20)
      const prices: Record<string, unknown> = {}
      let lastError: string | null = null

      for (const code of limited) {
        const { price, errorMsg } = await fetchStockPrice(creds, code)
        if (price) prices[code] = price
        else if (errorMsg) lastError = errorMsg
        // Rate limit: 50ms between requests
        if (limited.indexOf(code) < limited.length - 1) {
          await new Promise(r => setTimeout(r, 60))
        }
      }

      // 전체 조회 실패 시 에러 반환 (토큰 만료 등)
      if (Object.keys(prices).length === 0 && limited.length > 0) {
        return new Response(JSON.stringify({ error: lastError || "모든 종목 조회 실패" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      result = { prices, failed: limited.length - Object.keys(prices).length }

    } else if (action === "search" && body.code) {
      // Single stock search by code
      const { price, errorMsg } = await fetchStockPrice(creds, body.code)
      if (!price && errorMsg) {
        return new Response(JSON.stringify({ error: errorMsg }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      result = { stock: price }

    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
