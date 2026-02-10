import os
import json
import base64
import logging
import telnyx

logger = logging.getLogger(__name__)


def init_telnyx():
    """Initialize the Telnyx SDK with the API key."""
    telnyx.api_key = os.environ.get("TELNYX_API_KEY", "")


def initiate_call(
    phone_number: str, stream_url: str, webhook_url: str
) -> str:
    """
    Initiate an outbound call via Telnyx with L16 codec for raw PCM 16kHz.
    Returns the call_control_id.
    """
    call = telnyx.Call.create(
        connection_id=os.environ["TELNYX_CONNECTION_ID"],
        to=phone_number,
        from_=os.environ["TELNYX_PHONE_NUMBER"],
        webhook_url=webhook_url,
        stream_url=stream_url,
        stream_track="both_tracks",
        stream_bidirectional_mode="rtp",
        stream_bidirectional_codec="L16",
    )
    logger.info(f"Telnyx call initiated: {call.call_control_id}")
    return call.call_control_id


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
