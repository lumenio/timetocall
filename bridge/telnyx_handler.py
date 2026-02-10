import os
import json
import base64
import logging

import httpx

logger = logging.getLogger(__name__)

TELNYX_API_BASE = "https://api.telnyx.com/v2"


def _telnyx_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {os.environ.get('TELNYX_API_KEY', '')}",
        "Content-Type": "application/json",
    }


async def initiate_call(
    phone_number: str, stream_url: str, webhook_url: str
) -> str:
    """
    Initiate an outbound call via Telnyx REST API with L16 codec for raw PCM 16kHz.
    Returns the call_control_id.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{TELNYX_API_BASE}/calls",
            headers=_telnyx_headers(),
            json={
                "connection_id": os.environ["TELNYX_CONNECTION_ID"],
                "to": phone_number,
                "from": os.environ["TELNYX_PHONE_NUMBER"],
                "webhook_url": webhook_url,
                "stream_url": stream_url,
                "stream_track": "inbound_track",
                "stream_bidirectional_mode": "rtp",
                "stream_bidirectional_codec": "L16",
                "stream_bidirectional_sampling_rate": 16000,
            },
        )
        if resp.status_code >= 400:
            logger.error(f"Telnyx API error {resp.status_code}: {resp.text}")
        resp.raise_for_status()
        data = resp.json()["data"]
        call_control_id = data["call_control_id"]

    logger.info(f"Telnyx call initiated: {call_control_id}")
    return call_control_id


async def hangup_call(call_control_id: str) -> None:
    """Hang up a call via Telnyx REST API."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{TELNYX_API_BASE}/calls/{call_control_id}/actions/hangup",
            headers=_telnyx_headers(),
            json={},
        )
        resp.raise_for_status()


class TelnyxMediaHandler:
    """Parses and formats Telnyx WebSocket media stream messages."""

    @staticmethod
    def parse_message(raw: str) -> dict:
        """Parse a raw WebSocket message from Telnyx."""
        return json.loads(raw)

    @staticmethod
    def extract_audio(message: dict) -> bytes | None:
        """Extract audio bytes from a Telnyx media event."""
        if message.get("event") == "media":
            payload = message.get("media", {}).get("payload")
            if payload:
                return base64.b64decode(payload)
        return None

    @staticmethod
    def format_audio_message(audio_bytes: bytes) -> str:
        """Format audio bytes as a Telnyx WebSocket media message."""
        payload = base64.b64encode(audio_bytes).decode()
        return json.dumps({"event": "media", "media": {"payload": payload}})

    @staticmethod
    def is_stop_event(message: dict) -> bool:
        """Check if this is a stop event (call ended)."""
        return message.get("event") == "stop"

    @staticmethod
    def is_start_event(message: dict) -> bool:
        """Check if this is a start event (stream started)."""
        return message.get("event") == "start"
