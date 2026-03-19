# KIS (한국투자증권) Open API 사용 가이드

> KIS Open API를 연동하는 시스템에서 참고할 수 있는 범용 가이드입니다.
> API 키 설정, OAuth 토큰 관리, Supabase 기반 토큰 공유, API 목록을 포함합니다.

---

## 1. 사전 준비

### 1.1 KIS Developers 가입 및 API 키 발급

1. [KIS Developers](https://apiportal.koreainvestment.com) 접속
2. 한국투자증권 계좌 보유 상태에서 회원가입
3. **API 서비스 신청** (유효기간: 1년, 만료 시 재신청 필요)
4. **앱 키 발급** → `APP_KEY`, `APP_SECRET` 2개 값 획득

### 1.2 실전투자 vs 모의투자

| 구분 | Base URL | 비고 |
|------|----------|------|
| **실전투자** | `https://openapi.koreainvestment.com:9443` | 순위분석 API 지원 |
| 모의투자 | `https://openapivts.koreainvestment.com:29443` | 순위분석 API **미지원** |

> 등락률/거래량/거래대금 순위 API(`FHPST017xxxxx` 계열)는 **실전투자에서만** 사용 가능합니다.

---

## 2. API 키 설정 방법

### 2.1 환경변수

```bash
# 필수
KIS_APP_KEY=REDACTED_KIS_APP_KEY
KIS_APP_SECRET=REDACTED_KIS_APP_SECRET

# 선택 (계좌번호 — 주문 API 사용 시)
KIS_ACCOUNT_NO=12345678-01

# Supabase (토큰 공유용)
SUPABASE_URL=https://fyklcplybyfrfryopzvx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=REDACTED_SUPABASE_SERVICE_ROLE_KEY
```

### 2.2 Supabase 중앙 관리 (다중 환경 토큰 공유)

로컬 개발, CI/CD, 서버 등 **여러 환경에서 토큰을 공유**하려면 Supabase를 사용합니다.
KIS API 토큰은 1일 1회 발급 제한이 있으므로, 한 환경에서 발급한 토큰을 다른 환경에서 재사용하는 것이 핵심입니다.

**필요 환경변수:**
```bash
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> `SUPABASE_SERVICE_ROLE_KEY`는 Supabase 대시보드 → Settings → API → `service_role` (secret) 키입니다.
> RLS를 우회하여 직접 DB 접근이 필요하므로 `anon` 키가 아닌 `service_role` 키를 사용합니다.

**Supabase 테이블: `api_credentials`**

```sql
CREATE TABLE api_credentials (
  id          BIGSERIAL PRIMARY KEY,
  service_name     TEXT NOT NULL,          -- 'kis'
  credential_type  TEXT NOT NULL,          -- 'app_key' | 'app_secret' | 'access_token'
  credential_value TEXT NOT NULL,          -- 키 값(평문) 또는 토큰 JSON
  expires_at       TIMESTAMPTZ,           -- 토큰 만료 시각 (UTC)
  is_active        BOOLEAN DEFAULT TRUE,
  environment      TEXT DEFAULT 'production',
  description      TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_name, credential_type)
);
```

**데이터 저장 형태:**

API 키(app_key, app_secret)는 **평문 값**으로 저장:

| service_name | credential_type | credential_value | expires_at | is_active |
|---|---|---|---|---|
| `kis` | `app_key` | `PSxxxxxxxx...` | NULL | true |
| `kis` | `app_secret` | `xxxxxxxxxx...` | NULL | true |

Access Token은 **JSON 문자열**로 저장:

| service_name | credential_type | credential_value | expires_at | is_active |
|---|---|---|---|---|
| `kis` | `access_token` | `{"access_token":"eyJ...","expires_at":"2026-03-20T13:45:00","issued_at":"2026-03-19T13:45:00"}` | `2026-03-20T13:45:00` | true |

> `expires_at` 컬럼은 DB 레벨 필터링용이고, JSON 내부의 `expires_at`은 애플리케이션 레벨에서 사용합니다.

**API 키 조회 쿼리:**
```sql
-- APP_KEY, APP_SECRET 조회
SELECT credential_type, credential_value
FROM api_credentials
WHERE service_name = 'kis' AND is_active = TRUE;
```

**토큰 조회 쿼리:**
```sql
-- 유효한 access_token 조회
SELECT credential_value, expires_at
FROM api_credentials
WHERE service_name = 'kis'
  AND credential_type = 'access_token'
  AND is_active = TRUE;
```

**토큰 저장 (upsert):**
```sql
-- 기존 토큰이 있으면 UPDATE, 없으면 INSERT
INSERT INTO api_credentials (service_name, credential_type, credential_value, expires_at, environment, description, is_active)
VALUES ('kis', 'access_token', '{"access_token":"eyJ...","expires_at":"...","issued_at":"..."}', '2026-03-20T13:45:00', 'production', 'KIS OAuth Access Token', TRUE)
ON CONFLICT (service_name, credential_type)
DO UPDATE SET
  credential_value = EXCLUDED.credential_value,
  expires_at = EXCLUDED.expires_at,
  updated_at = NOW();
```

**Supabase Python SDK 사용 예시:**
```python
from supabase import create_client
import json

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# API 키 조회
response = client.table('api_credentials').select(
    'credential_type, credential_value'
).eq('service_name', 'kis').eq('is_active', True).execute()

creds = {row['credential_type']: row['credential_value'] for row in response.data}
app_key = creds.get('app_key')
app_secret = creds.get('app_secret')

# 토큰 조회
response = client.table('api_credentials').select(
    'credential_value, expires_at'
).eq('service_name', 'kis').eq(
    'credential_type', 'access_token'
).eq('is_active', True).execute()

if response.data:
    token_data = json.loads(response.data[0]['credential_value'])
    access_token = token_data['access_token']

# 토큰 저장
token_json = json.dumps({
    'access_token': new_token,
    'expires_at': expires_at.isoformat(),
    'issued_at': issued_at.isoformat(),
})
client.table('api_credentials').update({
    'credential_value': token_json,
    'expires_at': expires_at.isoformat(),
    'updated_at': datetime.utcnow().isoformat(),
}).eq('service_name', 'kis').eq('credential_type', 'access_token').execute()
```

**키 로드 우선순위 (권장):**
1. Supabase `api_credentials` 테이블에서 조회
2. 실패 시 → 환경변수 (`KIS_APP_KEY`, `KIS_APP_SECRET`) 폴백

### 2.3 GitHub Actions

GitHub Repository → Settings → Secrets and variables → Actions에 등록:

```
KIS_APP_KEY               → Repository secrets
KIS_APP_SECRET            → Repository secrets
SUPABASE_URL              → Repository secrets
SUPABASE_SERVICE_ROLE_KEY → Repository secrets
```

워크플로우 YAML에서 환경변수로 주입:
```yaml
env:
  KIS_APP_KEY: ${{ secrets.KIS_APP_KEY }}
  KIS_APP_SECRET: ${{ secrets.KIS_APP_SECRET }}
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

> GitHub Actions에서는 `actions/cache@v4`로 로컬 토큰 캐시 파일을 일자별 키로 캐싱하면 Supabase 장애 시에도 토큰을 유지할 수 있습니다.

---

## 3. OAuth 토큰 관리

### 3.1 핵심 제약사항

- **Access Token 발급: 1일 1회 제한** (24시간 이내 재발급 불가)
- 토큰 유효기간: **24시간**
- 만료된 토큰으로 API 호출 시 `401 Unauthorized` 또는 응답 본문에 "만료" 메시지

### 3.2 토큰 발급

```
POST {BASE_URL}/oauth2/tokenP
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "appkey": "APP_KEY",
  "appsecret": "APP_SECRET"
}
```

**응답:**
```json
{
  "access_token": "eyJ0eXAi...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

### 3.3 토큰 캐시 전략 (권장: 이중 저장)

1일 1회 발급 제한 때문에, 토큰을 반드시 캐시하고 여러 환경에서 공유해야 합니다.

```
[토큰 발급] → Supabase DB (api_credentials 테이블) ... 다중 환경 공유용
           → 로컬 파일 (.kis_token_cache.json)     ... 오프라인 폴백용
```

**토큰 로드 우선순위:**
1. **Supabase** → 다른 환경이 발급한 유효 토큰 재사용
2. **로컬 파일** → Supabase 미연결 시 폴백

**로컬 캐시 파일 구조** (`.kis_token_cache.json`):
```json
{
  "token": {
    "access_token": "eyJ0eXAi...",
    "expires_at": "2026-03-20T13:45:00",
    "issued_at": "2026-03-19T13:45:00"
  }
}
```

### 3.4 토큰 갱신 로직

```
API 호출 시작
  ↓
캐시된 토큰이 유효한가? (만료 10분 전까지 유효)
  ├─ Yes → 그대로 사용
  └─ No  → 만료된 토큰이라도 일단 사용 시도
              ↓
          401 응답 또는 "만료" 메시지?
            ├─ Yes → Supabase에서 유효 토큰 재조회
            │         ├─ 있음 → 재사용 (다른 환경이 갱신한 토큰)
            │         └─ 없음 → 신규 발급 (1일 1회 제한 확인)
            └─ No  → 정상 응답 처리
```

**강제 재발급 (비상용):**
- 토큰이 완전히 무효화된 경우에만 사용 (일일 횟수 제한 권장)
- Supabase에서 유효 토큰을 먼저 확인한 후 없을 때만 실행

---

## 4. API 호출 방법

### 4.1 요청 헤더

모든 API 요청에 필수인 헤더:

```
Content-Type: application/json; charset=utf-8
authorization: Bearer {access_token}
appkey: {APP_KEY}
appsecret: {APP_SECRET}
tr_id: {거래ID}
custtype: P
```

> `tr_id`는 API별로 고유한 거래 ID입니다 (예: `FHKST01010100` = 현재가 시세).

### 4.2 호출 예시

```python
import requests

url = "https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price"
headers = {
    "Content-Type": "application/json; charset=utf-8",
    "authorization": f"Bearer {access_token}",
    "appkey": APP_KEY,
    "appsecret": APP_SECRET,
    "tr_id": "FHKST01010100",
    "custtype": "P",
}
params = {
    "FID_COND_MRKT_DIV_CODE": "J",
    "FID_INPUT_ISCD": "005930",  # 삼성전자
}

response = requests.get(url, headers=headers, params=params, timeout=30)
data = response.json()

if data.get("rt_cd") == "0":
    output = data["output"]
    print(f"현재가: {output['stck_prpr']}원")
else:
    print(f"오류: {data.get('msg1')}")
```

### 4.3 Rate Limiting

- **초당 최대 20건** (KIS 공식 제한)
- 요청 간 **최소 50ms 간격** 적용 권장

### 4.4 에러 처리 및 자동 재시도

| HTTP 상태 | 처리 |
|-----------|------|
| `200` + `rt_cd != "0"` | 응답 본문의 `msg1`에 "만료" 포함 시 토큰 재발급 후 재시도 |
| `401` | 토큰 재발급 후 1회 재시도 (무한 루프 방지 필수) |
| `403` | API 키 오류 — 서비스 미신청, 모의투자 키 사용 등 확인 |
| `500` + "만료" | 토큰 재발급 → 1일 제한 초과 시 강제 재발급 시도 |

> 재시도 시 **재귀 방지 플래그** (`_retry=False` 등)를 두어 무한 루프를 차단해야 합니다.

---

## 5. 사용 가능한 API 목록 (16개)

### 5.1 시세 조회 (6개)

| API | tr_id | 용도 |
|-----|-------|------|
| 주식현재가 시세 | `FHKST01010100` | 현재가, 등락률, 거래량 |
| 주식현재가 일별 시세 | `FHKST01010400` | 최근 30일 OHLCV (거래량 정확) |
| 국내주식기간별시세 | `FHKST03010100` | 일봉/주봉 차트 (최대 500일) |
| 주식현재가 분봉 | `FHKST03010200` | 당일 1분봉 |
| 업종 기간별 시세 | `FHKUP03500100` | 코스닥/코스피 지수 일봉 |
| 주식현재가 호가 | `FHKST01010200` | 호가/예상체결 |

### 5.2 투자자/수급 (4개)

| API | tr_id | 용도 |
|-----|-------|------|
| 주식현재가 투자자 | `FHKST01010900` | 최근 30일 투자자별 매매동향 |
| 외인기관 추정가집계 | `HHPTJ04160200` | 장중 가집계 (실시간) |
| 외국인기관 매매종목가집계 | `FHKST01010700` | 장중 수급 (보조) |
| 프로그램매매 투자자동향 | `HHPPG046600C1` | 프로그램 매매 동향 |

### 5.3 순위 분석 (3개) — 실전투자 전용

| API | tr_id | 용도 |
|-----|-------|------|
| 등락률 순위 | `FHPST01700000` | 상승/하락 종목 순위 |
| 거래량 순위 | `FHPST01710000` | 거래량 상위 종목 |
| 거래대금 순위 | `FHPST01710000` (`FID_BLNG_CLS_CODE="3"`) | 거래대금 상위 종목 |

> 거래대금 순위는 거래량 순위 API의 파라미터(`FID_BLNG_CLS_CODE="3"`)로 서버 측 거래대금 정렬을 요청합니다.

### 5.4 기타 (3개)

| API | tr_id | 용도 |
|-----|-------|------|
| 재무비율 | `FHKST66430300` | PER/PBR/ROE |
| 공매도 일별추이 | `FHPST04830000` | 공매도 현황 |
| 주식현재가 체결 | `FHKST01010300` | 실시간 체결 내역 |

---

## 6. 연동 시 체크리스트

- [ ] KIS Developers에서 **실전투자** 앱 키 발급 완료
- [ ] API 서비스 신청 완료 (1년 유효, 만료 시 재신청)
- [ ] 환경변수 `KIS_APP_KEY`, `KIS_APP_SECRET` 설정
- [ ] (다중 환경) Supabase `api_credentials` 테이블 생성 및 환경변수 설정
- [ ] 토큰 **1일 1회 발급 제한** 인지 → 캐시 전략 필수
- [ ] Rate Limit **초당 20건** 준수 → 요청 간 50ms 이상 간격
- [ ] 순위 API 사용 시 **실전투자 키 필수** (모의투자 미지원)
- [ ] 토큰 만료 시 **401 자동 재시도** 로직 구현 (무한 루프 방지)

---

## 7. 주의사항 및 트러블슈팅

### 403 Forbidden
- APP_KEY/APP_SECRET 불일치
- API 서비스 미신청 또는 만료 (1년 유효)
- 모의투자 키를 실전투자 URL에 사용
- 확인: [KIS Developers](https://apiportal.koreainvestment.com)에서 서비스 상태 확인

### 토큰 발급 실패 (1일 제한)
- 이미 당일 발급한 토큰이 있으면 재발급 불가
- Supabase 또는 로컬 캐시에서 기존 토큰 재사용
- 다른 환경에서 발급한 토큰도 Supabase를 통해 공유 가능
- 마지막 발급 시각으로부터 23시간 이상 경과 후 재발급 시도

### 분봉 API 플레이스홀더 주의
- `inquire-time-itemchartprice` (`FHKST03010200`) API는 **미래 시간대에도 데이터를 반환**
- 마지막 체결가로 채워진 가짜 캔들이 포함됨
- 반드시 **현재 시각 이전 데이터만 필터링** (`cutoff_time` 사용)

### inquire-daily-itemchartprice 거래량 0 이슈
- `FHKST03010100` (국내주식기간별시세) API의 `acml_vol` 필드가 0을 반환하는 경우 있음
- `inquire-daily-price` (`FHKST01010400`) API의 거래량이 더 정확
- 대안: `FHKST03010100`으로 차트 데이터를 가져온 뒤, `FHKST01010400`으로 거래량을 보정하는 fallback 구현

### 응답 코드 확인
- HTTP 200이라도 `rt_cd != "0"`이면 비즈니스 로직 오류
- `msg1` 필드에 오류 메시지 포함
- 토큰 만료 시에도 HTTP 200으로 응답하면서 `msg1`에 "만료" 포함하는 경우 있음
