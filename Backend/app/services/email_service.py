import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.settings import SystemSetting

logger = logging.getLogger("email_service")

DEFAULT_EMAIL_SETTINGS = {
    "enabled": True,
    "recipient_email": "supervisor@huhtamaki.com",
    "sender_email": "alerts@pixtronsystems.com",
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 587,
    "smtp_user": "",
    "smtp_password": "",
    "use_tls": True,
}


def get_email_settings(db: Optional[Session] = None) -> Dict[str, Any]:
    """Retrieves current email alert configuration from database."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        row = db.scalar(
            select(SystemSetting).where(
                SystemSetting.section == "email",
                SystemSetting.key == "alert_config",
            )
        )
        if row and isinstance(row.value, dict):
            merged = {**DEFAULT_EMAIL_SETTINGS, **row.value}
            # Mask password in read
            if merged.get("smtp_password"):
                merged["has_password"] = True
            else:
                merged["has_password"] = False
            return merged
        return {**DEFAULT_EMAIL_SETTINGS, "has_password": False}
    finally:
        if should_close:
            db.close()


def save_email_settings(settings_data: Dict[str, Any], db: Optional[Session] = None) -> Dict[str, Any]:
    """Saves email alert configuration to database."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        row = db.scalar(
            select(SystemSetting).where(
                SystemSetting.section == "email",
                SystemSetting.key == "alert_config",
            )
        )
        current = row.value if (row and isinstance(row.value, dict)) else DEFAULT_EMAIL_SETTINGS.copy()

        # Update fields
        for k in ["enabled", "recipient_email", "sender_email", "smtp_host", "smtp_port", "use_tls"]:
            if k in settings_data:
                current[k] = settings_data[k]

        if "smtp_user" in settings_data:
            current["smtp_user"] = settings_data["smtp_user"]

        # Only update password if non-empty string provided
        if settings_data.get("smtp_password"):
            current["smtp_password"] = settings_data["smtp_password"]

        if row:
            row.value = current
        else:
            db.add(SystemSetting(section="email", key="alert_config", value=current))

        db.commit()
        ret = current.copy()
        ret["has_password"] = bool(ret.get("smtp_password"))
        ret["smtp_password"] = "********" if ret["has_password"] else ""
        return ret
    finally:
        if should_close:
            db.close()


def send_defect_email(defect: Dict[str, Any], db: Optional[Session] = None) -> Dict[str, Any]:
    """Dispatches an email notification when a critical defect halts the inspection line."""
    cfg = get_email_settings(db)
    if not cfg.get("enabled", True):
        return {"success": False, "reason": "Email alerts disabled in settings"}

    recipients = [r.strip() for r in cfg.get("recipient_email", "").split(",") if r.strip()]
    if not recipients:
        return {"success": False, "reason": "No recipient email configured"}

    sender = cfg.get("sender_email") or "alerts@pixtronsystems.com"
    defect_id = defect.get("defect_id", "N/A")
    expected = defect.get("expected_code", "N/A")
    scanned = defect.get("scanned_code", "N/A")
    reason = defect.get("reason", "Defect / Barcode Mismatch")
    ts = defect.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    subject = f"[CRITICAL DEFECT] Inspection Line Stopped - Defect #{defect_id}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }}
            .header {{ background-color: #dc2626; color: white; padding: 18px 24px; font-weight: bold; font-size: 18px; }}
            .content {{ padding: 24px; }}
            .alert-box {{ background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin-bottom: 20px; }}
            .row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }}
            .label {{ font-weight: bold; color: #64748b; font-size: 13px; }}
            .value {{ font-family: monospace; font-size: 14px; font-weight: bold; }}
            .mismatch {{ color: #dc2626; }}
            .expected {{ color: #059669; }}
            .footer {{ background: #f8fafc; padding: 14px 24px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">⚠️ Defect Alarm Notification • Line Stopped</div>
            <div class="content">
                <div class="alert-box">
                    <strong>Critical Defect Detected!</strong>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: #7f1d1d;">
                        The conveyor has been halted automatically by safety interlock DO-2. Physical buzzer has been activated.
                    </p>
                </div>
                <div class="row">
                    <span class="label">Defect S/N:</span>
                    <span class="value">#{defect_id}</span>
                </div>
                <div class="row">
                    <span class="label">Expected Reference Code:</span>
                    <span class="value expected">{expected}</span>
                </div>
                <div class="row">
                    <span class="label">Scanned Barcode:</span>
                    <span class="value mismatch">{scanned}</span>
                </div>
                <div class="row">
                    <span class="label">Defect Reason:</span>
                    <span class="value mismatch">{reason}</span>
                </div>
                <div class="row">
                    <span class="label">Timestamp:</span>
                    <span class="value">{ts}</span>
                </div>
                <div class="row">
                    <span class="label">Line Status:</span>
                    <span class="value mismatch">HALTED (Awaiting Operator Acknowledgment)</span>
                </div>
            </div>
            <div class="footer">
                Huhtamaki Vision Inspection System • Pixtron Systems Industrial Automation
            </div>
        </div>
    </body>
    </html>
    """

    return _dispatch_email(cfg, sender, recipients, subject, html_content)


def send_test_email(recipient_email: str, db: Optional[Session] = None) -> Dict[str, Any]:
    """Dispatches a test verification email to confirm email notifications are functional."""
    cfg = get_email_settings(db)
    target = recipient_email.strip() if recipient_email else cfg.get("recipient_email", "supervisor@huhtamaki.com")
    recipients = [target]
    sender = cfg.get("sender_email") or "alerts@pixtronsystems.com"

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    subject = f"[TEST] Huhtamaki Vision Inspection System - Email Alert Verification"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px; }}
            .container {{ max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1; overflow: hidden; }}
            .header {{ background-color: #153472; color: white; padding: 18px 24px; font-weight: bold; font-size: 16px; }}
            .content {{ padding: 24px; }}
            .success-badge {{ background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 14px; color: #065f46; font-size: 14px; margin-bottom: 16px; }}
            .info-item {{ margin-bottom: 8px; font-size: 13px; color: #475569; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">✉️ Huhtamaki Vision Alert Service Test</div>
            <div class="content">
                <div class="success-badge">
                    <strong>✓ Test Email Successful!</strong>
                    <p style="margin: 4px 0 0 0; font-size: 12px;">Your email alert channel is verified and ready to receive real-time defect notifications.</p>
                </div>
                <div class="info-item"><strong>Target Recipient:</strong> {target}</div>
                <div class="info-item"><strong>Timestamp:</strong> {now_str}</div>
                <div class="info-item"><strong>System Status:</strong> Operational (50ms Barcode Engine Active)</div>
            </div>
        </div>
    </body>
    </html>
    """

    return _dispatch_email(cfg, sender, recipients, subject, html_content)


def _dispatch_email(cfg: Dict[str, Any], sender: str, recipients: list[str], subject: str, html_body: str) -> Dict[str, Any]:
    """Internal SMTP transmission handler."""
    smtp_host = cfg.get("smtp_host", "smtp.gmail.com")
    smtp_port = int(cfg.get("smtp_port", 587))
    smtp_user = cfg.get("smtp_user", "")
    smtp_pass = cfg.get("smtp_password", "")
    use_tls = cfg.get("use_tls", True)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(html_body, "html"))

    # If SMTP credentials are fully provided, perform real network SMTP dispatch
    if smtp_user and smtp_pass:
        try:
            logger.info(f"Attempting live SMTP delivery to {recipients} via {smtp_host}:{smtp_port}...")
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=8.0)
            if use_tls:
                server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(sender, recipients, msg.as_string())
            server.quit()
            logger.info(f"Email successfully delivered to {recipients}")
            return {
                "success": True,
                "message": f"Email successfully dispatched to {', '.join(recipients)}",
                "recipient": recipients,
            }
        except Exception as e:
            logger.error(f"SMTP dispatch failed: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"SMTP transmission failed: {str(e)}",
                "recipient": recipients,
            }

    # If credentials are not yet entered, simulate and log delivery confirmation
    logger.info(f"[SIMULATED EMAIL DISPATCH] Alert prepared for {recipients}: {subject}")
    return {
        "success": True,
        "simulated": True,
        "message": f"Email alert simulated successfully to {', '.join(recipients)}. (Provide SMTP user & app password in Email Settings to deliver directly via live SMTP)",
        "recipient": recipients,
    }
