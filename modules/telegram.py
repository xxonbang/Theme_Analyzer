"""
텔레그램 메시지 발송 모듈
- 가독성 최적화 (이모지, 구분선, 계층 구조)
"""
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional

from config.settings import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID


class TelegramSender:
    """텔레그램 메시지 발송"""

    def __init__(
        self,
        bot_token: Optional[str] = None,
        chat_id: Optional[str] = None,
    ):
        self.bot_token = bot_token or TELEGRAM_BOT_TOKEN
        self.chat_id = chat_id or TELEGRAM_CHAT_ID
        self.api_url = f"https://api.telegram.org/bot{self.bot_token}"

    def send_message(self, text: str, parse_mode: str = "HTML", disable_preview: bool = True) -> bool:
        """텔레그램 메시지 발송"""
        if not self.bot_token or not self.chat_id:
            print("[ERROR] 텔레그램 설정이 없습니다. .env 파일을 확인하세요.")
            return False

        try:
            response = requests.post(
                f"{self.api_url}/sendMessage",
                json={
                    "chat_id": self.chat_id,
                    "text": text,
                    "parse_mode": parse_mode,
                    "disable_web_page_preview": disable_preview,
                },
                timeout=30,
            )

            if response.status_code == 200:
                return True
            else:
                print(f"[ERROR] 텔레그램 발송 실패: {response.status_code}")
                print(f"  응답: {response.text}")
                return False

        except Exception as e:
            print(f"[ERROR] 텔레그램 발송 예외: {e}")
            return False

    def _format_volume(self, volume: int) -> str:
        """거래량을 읽기 쉬운 형식으로 변환"""
        if volume >= 1_000_000:
            return f"{volume / 1_000_000:.1f}M"
        elif volume >= 1_000:
            return f"{volume / 1_000:.0f}K"
        else:
            return str(volume)

    def _format_price(self, price: int) -> str:
        """가격 포맷 (쉼표 구분)"""
        return f"{price:,}"

    def _get_change_emoji(self, rate: float) -> str:
        """등락률에 따른 이모지"""
        if rate >= 10:
            return "🔥"
        elif rate >= 5:
            return "📈"
        elif rate > 0:
            return "▲"
        elif rate <= -10:
            return "💥"
        elif rate <= -5:
            return "📉"
        elif rate < 0:
            return "▼"
        else:
            return "➖"

    def _format_3day_changes(self, history_data: Dict[str, Any]) -> str:
        """3일간 등락률 포맷 (D-2  D-1  D 순서, 화살표 없이)"""
        changes = history_data.get("changes", [])
        if not changes:
            return ""

        parts = []
        labels = ["D", "D-1", "D-2"]  # 오늘, 어제, 그저께

        for i, change in enumerate(changes):
            rate = change.get("change_rate", 0)
            sign = "+" if rate > 0 else ""
            label = labels[i] if i < len(labels) else f"D-{i}"
            parts.append(f"{label} {sign}{rate:.1f}%")

        # 역순으로 (D-2  D-1  D)
        parts.reverse()
        return "  |  ".join(parts)

    def _get_naver_finance_url(self, code: str) -> str:
        """네이버 파이낸스 모바일 URL 생성"""
        return f"https://m.stock.naver.com/domestic/stock/{code}/total"

    def _format_stock_line_with_history(
        self,
        stock: Dict[str, Any],
        history_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        """개별 종목 라인 포맷 (가독성 개선)"""
        rank = stock.get("rank", 0)
        name = stock.get("name", "")
        code = stock.get("code", "")
        price = stock.get("current_price", 0)
        change_rate = stock.get("change_rate", 0)
        volume = stock.get("volume", 0)

        # 등락률 이모지 및 부호
        emoji = self._get_change_emoji(change_rate)
        rate_sign = "+" if change_rate > 0 else ""

        # 네이버 파이낸스 링크
        naver_url = self._get_naver_finance_url(code)

        # 메인 라인 (종목명에 링크 추가)
        lines = [
            f"<b>{rank}. <a href=\"{naver_url}\">{name}</a></b> <code>{code}</code>",
            f"   {emoji} {self._format_price(price)}원 ({rate_sign}{change_rate:.2f}%) · {self._format_volume(volume)}주",
        ]

        # 3일간 등락률
        if history_data:
            history_str = self._format_3day_changes(history_data)
            if history_str:
                lines.append(f"   └ {history_str}")

        return "\n".join(lines)

    def _get_timestamp(self) -> str:
        """현재 시각 포맷"""
        from modules.utils import KST
        return datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")

    def format_start_barricade(self, exchange_data: Optional[Dict[str, Any]] = None) -> str:
        """시작 바리케이트 메시지 (환율 정보 포함)"""
        lines = ["🚀🚀🚀 START 🚀🚀🚀"]

        # 환율 정보 추가
        if exchange_data and exchange_data.get("rates"):
            lines.append("")
            lines.append("💱 <b>실시간 환율</b>")

            for rate in exchange_data["rates"]:
                currency = rate["currency"]
                value = rate["rate"]
                is_100 = rate.get("is_100", False)

                # 통화별 이모지
                emoji = {
                    "USD": "🇺🇸",
                    "JPY": "🇯🇵",
                    "EUR": "🇪🇺",
                    "CNY": "🇨🇳",
                }.get(currency, "💵")

                # 100엔 단위 표시
                unit = "(100)" if is_100 else ""
                lines.append(f"{emoji} {currency}{unit}: <b>{value:,.2f}</b>원")

            # 기준일
            search_date = exchange_data.get("search_date", "")
            if search_date:
                formatted_date = f"{search_date[:4]}-{search_date[4:6]}-{search_date[6:]}"
                lines.append(f"<i>📅 기준일: {formatted_date}</i>")

        return "\n".join(lines)

    def format_end_barricade(self) -> str:
        """종료 바리케이트 메시지"""
        return "🏁🏁🏁 END 🏁🏁🏁"

    def format_rising_stocks(
        self,
        kospi: List[Dict[str, Any]],
        kosdaq: List[Dict[str, Any]],
        history_data: Optional[Dict[str, Dict[str, Any]]] = None,
        title: str = "📈 거래량 + 상승률 TOP10",
    ) -> str:
        """상승 종목 메시지 포맷"""
        history_data = history_data or {}

        lines = [
            f"<b>{title}</b>",
            "",
        ]

        # 코스피
        lines.append("🔵 <b>KOSPI</b>")
        lines.append("")
        if kospi:
            for stock in kospi:
                code = stock.get("code", "")
                lines.append(self._format_stock_line_with_history(stock, history_data.get(code)))
                lines.append("")
        else:
            lines.append("   해당 종목 없음")
            lines.append("")

        # 코스닥
        lines.append("🟢 <b>KOSDAQ</b>")
        lines.append("")
        if kosdaq:
            for stock in kosdaq:
                code = stock.get("code", "")
                lines.append(self._format_stock_line_with_history(stock, history_data.get(code)))
                lines.append("")
        else:
            lines.append("   해당 종목 없음")
            lines.append("")

        # 타임스탬프
        lines.append(f"⏰ {self._get_timestamp()}")

        return "\n".join(lines)

    def format_falling_stocks(
        self,
        kospi: List[Dict[str, Any]],
        kosdaq: List[Dict[str, Any]],
        history_data: Optional[Dict[str, Dict[str, Any]]] = None,
        title: str = "📉 거래량 + 하락률 TOP10",
    ) -> str:
        """하락 종목 메시지 포맷"""
        history_data = history_data or {}

        lines = [
            f"<b>{title}</b>",
            "",
        ]

        # 코스피
        lines.append("🔵 <b>KOSPI</b>")
        lines.append("")
        if kospi:
            for stock in kospi:
                code = stock.get("code", "")
                lines.append(self._format_stock_line_with_history(stock, history_data.get(code)))
                lines.append("")
        else:
            lines.append("   해당 종목 없음")
            lines.append("")

        # 코스닥
        lines.append("🟢 <b>KOSDAQ</b>")
        lines.append("")
        if kosdaq:
            for stock in kosdaq:
                code = stock.get("code", "")
                lines.append(self._format_stock_line_with_history(stock, history_data.get(code)))
                lines.append("")
        else:
            lines.append("   해당 종목 없음")
            lines.append("")

        # 타임스탬프
        lines.append(f"⏰ {self._get_timestamp()}")

        return "\n".join(lines)

    def _escape_html(self, text: str) -> str:
        """HTML 특수문자 이스케이프"""
        return (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

    def format_theme_analysis(self, theme_analysis: Dict[str, Any]) -> List[str]:
        """AI 테마 분석 메시지 포맷

        Returns:
            메시지 리스트 (4096자 제한 분할)
        """
        if not theme_analysis or not theme_analysis.get("themes"):
            return []

        messages = []
        current_lines = [
            "✨ <b>AI 테마 분석</b>",
            f"<i>{theme_analysis.get('analysis_date', '')} 분석</i>",
            "",
            theme_analysis.get("market_summary", ""),
            "",
        ]

        for i, theme in enumerate(theme_analysis.get("themes", []), 1):
            theme_lines = [
                f"━━━━━━━━━━━━━━━",
                f"<b>테마 {i}. {theme.get('theme_name', '')}</b>",
                f"{theme.get('theme_description', '')}",
                "",
            ]

            # 대장주
            for stock in theme.get("leader_stocks", []):
                name = stock.get("name", "")
                code = stock.get("code", "")
                reason = stock.get("reason", "")
                url = self._get_naver_finance_url(code)

                theme_lines.append(f"  🏆 <a href=\"{url}\">{name}</a> <code>{code}</code>")
                theme_lines.append(f"     {reason}")

                # 뉴스 근거
                for evidence in stock.get("news_evidence", [])[:2]:
                    title_text = evidence.get("title", "")
                    if len(title_text) > 40:
                        title_text = title_text[:37] + "..."
                    escaped = self._escape_html(title_text)
                    news_url = evidence.get("url", "")
                    if news_url:
                        theme_lines.append(f"     • <a href=\"{news_url}\">{escaped}</a>")
                    else:
                        theme_lines.append(f"     • {escaped}")

                theme_lines.append("")

            # 메시지 길이 체크
            test_message = "\n".join(current_lines + theme_lines)
            if len(test_message) > 3800:
                current_lines.append(f"⏰ {self._get_timestamp()}")
                messages.append("\n".join(current_lines))
                current_lines = [
                    "✨ <b>AI 테마 분석</b> (계속)",
                    "",
                ]

            current_lines.extend(theme_lines)

        if len(current_lines) > 2:
            current_lines.append(f"⏰ {self._get_timestamp()}")
            messages.append("\n".join(current_lines))

        return messages

    @staticmethod
    def _fmt_net(val) -> str:
        """순매수량 부호 + 쉼표 포맷"""
        if val is None:
            return "-"
        sign = "+" if val > 0 else ""
        return f"{sign}{val:,}"

    def _format_member_line(self, member: Dict[str, Any]) -> str:
        """거래원 이름 포맷 (외국계면 * 표시)"""
        name = member.get("name", "")
        return f"{name}*" if member.get("is_foreign") else name

    def format_investor_data(
        self,
        investor_data: Dict[str, Dict[str, Any]],
        leader_info: Dict[str, Dict[str, Any]],
        is_estimated: bool = False,
        member_data: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> str:
        """대장주 수급 데이터 텔레그램 메시지 포맷

        Args:
            investor_data: {code: {name, foreign_net, institution_net, individual_net, program_net}}
            leader_info: {code: {name, theme}}
            is_estimated: 추정치 여부
            member_data: {code: {buy_top5, sell_top5, ...}}
        """
        member_data = member_data or {}
        label = "추정" if is_estimated else "확정"
        lines = [
            f"📊 <b>대장주 수급 현황</b> ({label})",
            "",
        ]

        for code, data in investor_data.items():
            name = data.get("name", leader_info.get(code, {}).get("name", code))
            theme = leader_info.get(code, {}).get("theme", "")
            foreign = data.get("foreign_net", 0)
            institution = data.get("institution_net", 0)
            individual = data.get("individual_net")
            program = data.get("program_net")

            url = self._get_naver_finance_url(code)

            # 외국인/기관 동시 순매수면 강조
            both_buy = foreign > 0 and institution > 0

            lines.append(f"{'🔥 ' if both_buy else ''}<a href=\"{url}\"><b>{name}</b></a> <code>{code}</code>")
            if theme:
                lines.append(f"   {theme}")

            parts = [f"외국인 {self._fmt_net(foreign)}", f"기관 {self._fmt_net(institution)}"]
            if individual is not None:
                parts.append(f"개인 {self._fmt_net(individual)}")
            lines.append(f"   {' | '.join(parts)}")

            if program is not None:
                lines.append(f"   프로그램 {self._fmt_net(program)}")

            # 거래원 (매수/매도 상위 1~3위)
            member = member_data.get(code)
            if member:
                buy_names = [self._format_member_line(b) for b in member.get("buy_top5", [])[:3]]
                sell_names = [self._format_member_line(s) for s in member.get("sell_top5", [])[:3]]
                if buy_names:
                    lines.append(f"   매수▶ {', '.join(buy_names)}")
                if sell_names:
                    lines.append(f"   매도▶ {', '.join(sell_names)}")

            lines.append("")

        lines.append(f"⏰ {self._get_timestamp()}")
        return "\n".join(lines)

    def format_top20_investor_data(
        self,
        investor_data: Dict[str, Dict[str, Any]],
        top20_stocks: List[Dict[str, Any]],
        is_estimated: bool = False,
        member_data: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> str:
        """거래대금 TOP20 수급 데이터 텔레그램 메시지 포맷

        Args:
            investor_data: {code: {name, foreign_net, institution_net, individual_net, program_net}}
            top20_stocks: 거래대금 순 정렬된 종목 리스트 [{code, name, market, ...}]
            is_estimated: 추정치 여부
            member_data: {code: {buy_top5, sell_top5, ...}}
        """
        member_data = member_data or {}
        label = "추정" if is_estimated else "확정"
        lines = [
            f"💰 <b>거래대금 TOP20 수급 현황</b> ({label})",
            "",
        ]

        for i, stock in enumerate(top20_stocks, 1):
            code = stock.get("code", "")
            if code not in investor_data:
                continue

            data = investor_data[code]
            name = stock.get("name", data.get("name", code))
            market = stock.get("market", "")
            foreign = data.get("foreign_net", 0)
            institution = data.get("institution_net", 0)
            individual = data.get("individual_net")
            program = data.get("program_net")

            url = self._get_naver_finance_url(code)

            both_buy = foreign > 0 and institution > 0

            lines.append(f"{'🔥 ' if both_buy else ''}{i}. <a href=\"{url}\"><b>{name}</b></a> <code>{code}</code>")
            lines.append(f"   {market}")

            parts = [f"외국인 {self._fmt_net(foreign)}", f"기관 {self._fmt_net(institution)}"]
            if individual is not None:
                parts.append(f"개인 {self._fmt_net(individual)}")
            lines.append(f"   {' | '.join(parts)}")

            if program is not None:
                lines.append(f"   프로그램 {self._fmt_net(program)}")

            # 거래원 (매수/매도 상위 1~3위)
            member = member_data.get(code)
            if member:
                buy_names = [self._format_member_line(b) for b in member.get("buy_top5", [])[:3]]
                sell_names = [self._format_member_line(s) for s in member.get("sell_top5", [])[:3]]
                if buy_names:
                    lines.append(f"   매수▶ {', '.join(buy_names)}")
                if sell_names:
                    lines.append(f"   매도▶ {', '.join(sell_names)}")

            lines.append("")

        lines.append(f"⏰ {self._get_timestamp()}")
        return "\n".join(lines)

