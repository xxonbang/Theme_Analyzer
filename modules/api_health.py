"""API 키 오류 감지 + Supabase 알림 + 이메일 발송 모듈"""
import os
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText


def _get_supabase_client():
    """Supabase service_role 클라이언트 반환 (없으면 None)"""
    try:
        from modules.supabase_client import get_supabase_manager
        manager = get_supabase_manager()
        return manager._get_client()
    except Exception:
        return None


def report_key_failure(service_name: str, error_type: str, error_message: str = ""):
    """API 키 오류를 Supabase에 기록하고 이메일 발송 (6시간 중복 방지)"""
    now = datetime.now(timezone.utc)
    client = _get_supabase_client()

    if client:
        try:
            client.table("api_key_alerts").upsert(
                {
                    "service_name": service_name,
                    "error_type": error_type,
                    "error_message": error_message[:500],
                    "detected_at": now.isoformat(),
                    "resolved_at": None,
                },
                on_conflict="service_name,error_type",
            ).execute()
        except Exception as e:
            print(f"  ⚠ api_key_alerts UPSERT 실패: {e}")

    # 이메일 발송 (6시간 중복 방지)
    should_notify = True
    if client:
        try:
            row = (
                client.table("api_key_alerts")
                .select("last_notified_at")
                .eq("service_name", service_name)
                .eq("error_type", error_type)
                .single()
                .execute()
            )
            last = row.data.get("last_notified_at") if row.data else None
            if last:
                last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
                if now - last_dt < timedelta(hours=6):
                    should_notify = False
        except Exception:
            pass

    if should_notify:
        sent = _send_alert_email(service_name, error_type, error_message)
        if sent and client:
            try:
                client.table("api_key_alerts").update(
                    {"last_notified_at": now.isoformat()}
                ).eq("service_name", service_name).eq("error_type", error_type).execute()
            except Exception:
                pass


def resolve_key_alert(service_name: str):
    """해당 서비스의 모든 미해결 알림에 resolved_at 설정"""
    client = _get_supabase_client()
    if not client:
        return
    try:
        client.table("api_key_alerts").update(
            {"resolved_at": datetime.now(timezone.utc).isoformat()}
        ).eq("service_name", service_name).is_("resolved_at", "null").execute()
    except Exception as e:
        print(f"  ⚠ api_key_alerts resolve 실패: {e}")


def _send_alert_email(service_name: str, error_type: str, error_message: str) -> bool:
    """Gmail SMTP로 알림 이메일 발송"""
    gmail_user = os.getenv("GMAIL_USER")
    gmail_pass = os.getenv("GMAIL_APP_PASSWORD")
    if not gmail_user or not gmail_pass:
        return False

    subject = f"[Theme Analysis] API Key Alert: {service_name} - {error_type}"
    body = (
        f"Service: {service_name}\n"
        f"Error Type: {error_type}\n"
        f"Message: {error_message}\n"
        f"Detected At: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
    )

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = gmail_user
    msg["To"] = "mackulri@gmail.com"

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
            server.login(gmail_user, gmail_pass)
            server.send_message(msg)
        print(f"  ✉ 알림 이메일 발송 완료: {service_name} ({error_type})")
        return True
    except Exception as e:
        print(f"  ⚠ 알림 이메일 발송 실패: {e}")
        return False
