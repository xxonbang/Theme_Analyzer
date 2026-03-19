"""
KOSPI/KOSDAQ 전체 종목 마스터 데이터 생성
KIS API의 등락률 순위 API를 사용하여 전체 종목 코드/이름을 수집합니다.
(순위 API는 KOSPI/KOSDAQ 각각 상승/하락 최대 500개 반환 → 사실상 전종목 커버)

출력: frontend/public/data/stock-master.json
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from modules.kis_client import KISClient

OUTPUT_PATH = Path(__file__).parent.parent / "frontend" / "public" / "data" / "stock-master.json"

# ETF/ETN 코드 대역 필터
ETF_PREFIXES = {"069", "091", "097", "098", "099", "100", "101", "102", "103",
                "104", "105", "107", "108", "109", "112", "114", "117", "130",
                "131", "132", "133", "136", "137", "138", "139", "140", "143",
                "144", "145", "146", "147", "148", "150", "152", "153", "155",
                "156", "157", "159", "160", "161", "166", "167", "168", "169",
                "170", "171", "174", "176", "182", "183", "185", "187", "189",
                "190", "191", "192", "193", "195", "196", "200", "203", "204",
                "205", "206", "207", "208", "210", "211", "213", "214", "215",
                "217", "218", "219", "222", "223", "224", "225", "226", "227",
                "228", "229", "230", "231", "232", "233", "234", "236", "237",
                "238", "239", "241", "243", "244", "245", "246", "247", "248",
                "249", "251", "252", "253", "254", "255", "256", "260", "261",
                "266", "267", "268", "269", "270", "271", "272", "273", "274",
                "275", "276", "277", "278", "279", "280", "281", "282", "283",
                "284", "285", "286", "287", "288", "289", "290", "291", "292",
                "293", "294", "295", "296", "297", "298", "299", "300", "301",
                "302", "303", "304", "305", "306", "307", "308", "309", "310",
                "311", "312", "313", "314", "315", "316", "317", "318", "319",
                "320", "321", "322", "323", "324", "325", "326", "327", "328",
                "329", "330", "332", "333", "334", "335", "336", "337", "338",
                "339", "340", "341", "342", "343", "344", "345", "346", "347",
                "348", "349", "350", "351", "352", "353", "354", "355", "356",
                "357", "358", "359", "360", "361", "362", "363", "364", "365",
                "366", "367", "368", "369", "370", "371", "372", "373", "374",
                "375", "376", "377", "378", "379", "380", "381", "382", "383",
                "384", "385", "386", "387", "388", "389", "390", "391", "392",
                "393", "394", "395", "396", "397", "398", "399", "400", "401",
                "402", "403", "404", "405", "406", "407", "408", "409", "410",
                "411", "412", "413", "414", "415", "416", "417", "418", "419",
                "420", "421", "422", "423", "424", "425", "426", "427", "428",
                "429", "430", "431", "432", "433", "434", "435", "436", "437",
                "438", "439", "440", "441", "442", "443", "444", "445", "446",
                "447", "448", "449", "450", "451", "452", "453", "454", "455",
                "456", "457", "458", "459", "460", "461", "462", "463", "464",
                "465", "466", "467", "468", "469", "470", "471", "472", "473",
                "474", "475", "476", "477", "478", "479", "480", "481", "482",
                "483", "484", "485", "486", "487", "488", "489", "490", "491",
                "492", "493", "494", "495", "496", "497", "498", "499", "500",
                "501", "502", "503", "504", "505", "506", "507", "508", "509",
                "510", "511", "512", "513", "514", "515", "516", "517", "518",
                "519", "520"}


def is_etf_etn(code: str) -> bool:
    """ETF/ETN 필터"""
    return code[:3] in ETF_PREFIXES


def fetch_rank_stocks(client: KISClient, market: str, direction: str) -> list:
    """거래량 순위 API로 종목 목록 수집"""
    path = "/uapi/domestic-stock/v1/quotations/volume-rank"
    tr_id = "FHPST01710000"

    params = {
        "FID_COND_MRKT_DIV_CODE": "J",
        "FID_COND_SCR_DIV_CODE": "20174",
        "FID_INPUT_ISCD": "0000" if market == "KOSPI" else "1000",
        "FID_DIV_CLS_CODE": "0",
        "FID_BLNG_CLS_CODE": "0",
        "FID_TRGT_CLS_CODE": "",
        "FID_TRGT_EXLS_CLS_CODE": "",
        "FID_INPUT_PRICE_1": "",
        "FID_INPUT_PRICE_2": "",
        "FID_VOL_CNT": "",
        "FID_INPUT_DATE_1": "",
    }

    result = client.request("GET", path, tr_id, params=params)
    if result.get("rt_cd") != "0":
        return []

    stocks = []
    for item in result.get("output", []):
        code = item.get("mksc_shrn_iscd", "")
        name = item.get("hts_kor_isnm", "")
        if code and name and not is_etf_etn(code):
            stocks.append({"code": code, "name": name, "market": market})

    return stocks


def main():
    from datetime import datetime
    from modules.utils import KST

    print("[StockMaster] KIS API로 종목 마스터 생성 시작")
    client = KISClient()

    seen = set()
    result = []

    # 거래량 순위로 KOSPI/KOSDAQ 종목 수집
    for market in ["KOSPI", "KOSDAQ"]:
        stocks = fetch_rank_stocks(client, market, "up")
        for s in stocks:
            if s["code"] not in seen:
                seen.add(s["code"])
                result.append(s)
        print(f"  {market} 거래량순위: {len(stocks)}종목 (누적 {len(result)})")
        time.sleep(0.1)

    # 기존 latest.json에서 추가 종목 보충
    latest_path = Path(__file__).parent.parent / "frontend" / "public" / "data" / "latest.json"
    if latest_path.exists():
        with open(latest_path, "r", encoding="utf-8") as f:
            latest = json.load(f)

        sections = [
            latest.get("rising", {}),
            latest.get("falling", {}),
            latest.get("volume", {}),
            latest.get("trading_value", {}),
        ]
        for sec in sections:
            for market_key in ["kospi", "kosdaq"]:
                for s in sec.get(market_key, []):
                    code = s.get("code", "")
                    name = s.get("name", "")
                    if code and name and code not in seen:
                        seen.add(code)
                        market = "KOSPI" if market_key == "kospi" else "KOSDAQ"
                        result.append({"code": code, "name": name, "market": market})

        # theme_analysis stocks
        themes = latest.get("theme_analysis", {}).get("themes", [])
        for theme in themes:
            for s in theme.get("leader_stocks", []):
                code = s.get("code", "")
                name = s.get("name", "")
                if code and name and code not in seen:
                    seen.add(code)
                    result.append({"code": code, "name": name, "market": "UNKNOWN"})

        print(f"  latest.json 보충 후: {len(result)}종목")

    result.sort(key=lambda x: x["code"])

    today = datetime.now(KST).strftime("%Y%m%d")
    output = {
        "updated_at": today,
        "count": len(result),
        "stocks": result,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"[StockMaster] 완료: {len(result)}종목, {size_kb:.1f}KB → {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
