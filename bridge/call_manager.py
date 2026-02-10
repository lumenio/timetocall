import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx
from google.genai import types
from fastapi import WebSocket

from audio_utils import l16_to_pcm_le, pcm_le_to_l16, resample_audio
from gemini_bridge import (
    build_system_prompt,
    create_gemini_config,
    create_gemini_client,
    generate_summary,
    MODEL,
)
from telnyx_handler import TelnyxMediaHandler, initiate_call, hangup_call

logger = logging.getLogger(__name__)

MAX_CALL_DURATION = 5 * 60  # 5 minutes
NO_ANSWER_TIMEOUT = 30  # seconds


@dataclass
class CallState:
    call_id: str
    phone_number: str
    briefing: str
    language: str
    user_name: str
    callback_url: str
    status: str = "pending"
    telnyx_call_control_id: str = ""
    transcript: list[dict] = field(default_factory=list)
    start_time: float = 0.0
    connected_time: float = 0.0
    answer_event: asyncio.Event = field(default_factory=asyncio.Event)


# In-memory registry of active calls
active_calls: dict[str, CallState] = {}

# HTTP client for callbacks
_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=10.0)
    return _http_client


async def send_callback(
    callback_url: str,
    event: str,
    call_id: str,
    bridge_secret: str,
    **kwargs,
):
    """Send a status callback to the Next.js backend."""
    try:
        client = _get_http_client()
        payload = {"call_id": call_id, "event": event, **kwargs}
        await client.post(
            callback_url,
            json=payload,
            headers={"Authorization": f"Bearer {bridge_secret}"},
        )
    except Exception as e:
        logger.error(f"Callback failed for {call_id}: {e}")


async def start_call(
    call_id: str,
    phone_number: str,
    briefing: str,
    language: str,
    user_name: str,
    callback_url: str,
    bridge_public_url: str,
    bridge_secret: str,
) -> str:
    """
    Initiate a new call. Creates call state, dials via Telnyx.
    Returns the Telnyx call_control_id.
    """
    state = CallState(
        call_id=call_id,
        phone_number=phone_number,
        briefing=briefing,
        language=language,
        user_name=user_name,
        callback_url=callback_url,
        start_time=time.time(),
    )
    active_calls[call_id] = state

    # Telnyx will connect its WebSocket to this URL
    stream_url = f"wss://{bridge_public_url}/telnyx/media-stream?call_id={call_id}"
    webhook_url = f"https://{bridge_public_url}/telnyx/webhook"

    logger.info(f"Telnyx stream_url: {stream_url}")
    logger.info(f"Telnyx webhook_url: {webhook_url}")

    try:
        call_control_id = await initiate_call(phone_number, stream_url, webhook_url)
        state.telnyx_call_control_id = call_control_id
        state.status = "dialing"

        await send_callback(
            callback_url,
            "status_update",
            call_id,
            bridge_secret,
            status="dialing",
        )

        # Start no-answer timeout
        asyncio.create_task(_no_answer_timeout(call_id, bridge_secret))
        # Safety net: force-complete if hangup webhook never arrives
        asyncio.create_task(_max_duration_timeout(call_id, bridge_secret))

        return call_control_id
    except Exception as e:
        logger.error(f"Failed to initiate call {call_id}: {e}")
        active_calls.pop(call_id, None)
        await send_callback(
            callback_url,
            "status_update",
            call_id,
            bridge_secret,
            status="failed",
        )
        raise


def find_call_by_telnyx_id(call_control_id: str) -> CallState | None:
    """Look up a CallState by its Telnyx call_control_id."""
    for state in active_calls.values():
        if state.telnyx_call_control_id == call_control_id:
            return state
    return None


async def handle_call_answered(call_id: str):
    """Called when Telnyx call.answered webhook arrives."""
    state = active_calls.get(call_id)
    if state:
        state.answer_event.set()
        logger.info(f"Call answered: {call_id}")


async def handle_call_hangup(call_id: str, bridge_secret: str):
    """Called when Telnyx call.hangup webhook arrives."""
    logger.info(f"Call hangup webhook: {call_id}")
    await _complete_call(call_id, bridge_secret)


async def _max_duration_timeout(call_id: str, bridge_secret: str):
    """Safety net: force-complete the call if hangup webhook is never received."""
    await asyncio.sleep(MAX_CALL_DURATION + 30)
    state = active_calls.get(call_id)
    if state and state.status not in ("completed", "failed"):
        logger.warning(f"Max duration safety timeout for {call_id}")
        await _complete_call(call_id, bridge_secret)


async def _wait_for_answer_or_ws_close(websocket: WebSocket, state: CallState) -> bool:
    """Wait for the call to be answered or the WebSocket to close.

    Returns True if the call was answered, False if the WS closed first.
    """
    async def drain_ws():
        try:
            while True:
                await websocket.receive_text()
        except Exception:
            pass

    drain_task = asyncio.create_task(drain_ws())
    answer_task = asyncio.create_task(state.answer_event.wait())

    done, pending = await asyncio.wait(
        [drain_task, answer_task],
        return_when=asyncio.FIRST_COMPLETED,
    )
    for t in pending:
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass

    return answer_task in done


async def _no_answer_timeout(call_id: str, bridge_secret: str):
    """If the Telnyx WebSocket doesn't connect within timeout, fail the call."""
    await asyncio.sleep(NO_ANSWER_TIMEOUT)
    state = active_calls.get(call_id)
    if state and state.status in ("dialing", "ringing", "pending"):
        logger.warning(f"No answer timeout for call {call_id}")
        await _complete_call(call_id, bridge_secret, failed=True)


async def handle_telnyx_websocket(
    websocket: WebSocket,
    call_id: str,
    bridge_secret: str,
):
    """
    Handle a Telnyx media WebSocket connection.

    Telnyx may open TWO WebSocket connections per call:
    1. Early media WS — before call.answered (ringing/comfort noise)
    2. Active media WS — after call.answered (actual call audio)

    This handler waits for the answer event before starting Gemini.
    If the WS closes before the call is answered (early media WS
    being replaced), it returns cleanly without cleanup so the
    second WS can take over.
    """
    state = active_calls.get(call_id)
    if not state:
        logger.error(f"No active call found for {call_id}")
        await websocket.close()
        return

    logger.info(
        f"WS handler for {call_id}, answered={state.answer_event.is_set()}"
    )

    # If call not yet answered, this is the early media WebSocket.
    # Wait for either: answer event, or WS close.
    if not state.answer_event.is_set():
        answered = await _wait_for_answer_or_ws_close(websocket, state)
        if not answered:
            logger.info(f"Early media WS closed before answer for {call_id}")
            return  # No cleanup — second WS will handle the call

    # Call is answered. Start Gemini bridge on this WebSocket.
    state.status = "connected"
    state.connected_time = time.time()

    await send_callback(
        state.callback_url,
        "status_update",
        call_id,
        bridge_secret,
        status="connected",
    )

    # Build Gemini session
    system_prompt = build_system_prompt(
        state.briefing, state.user_name, state.language
    )
    config = create_gemini_config(system_prompt)
    client = create_gemini_client()

    try:
        async with client.aio.live.connect(
            model=MODEL, config=config
        ) as session:
            logger.info(f"Gemini Live session connected for call {call_id}")

            # Trigger Gemini to start the conversation — without this,
            # both sides sit in silence waiting for the other to speak.
            await session.send_client_content(
                turns=types.Content(
                    role="user",
                    parts=[types.Part(text="The phone call is now connected. The other person has answered. Begin the conversation now.")],
                ),
                turn_complete=True,
            )
            logger.info(f"Sent initial prompt to Gemini for call {call_id}")

            await _bridge_audio(websocket, session, state, bridge_secret)
    except Exception as e:
        logger.error(f"Gemini session error for call {call_id}: {e}")
    # NOTE: No _complete_call here. The hangup webhook handles call completion.


async def _bridge_audio(
    telnyx_ws: WebSocket,
    gemini_session,
    state: CallState,
    bridge_secret: str,
):
    """Bridge audio between Telnyx WebSocket and Gemini Live API session."""
    media_handler = TelnyxMediaHandler()

    async def phone_to_gemini():
        """Forward phone audio to Gemini. L16 BE → PCM LE (byte swap only)."""
        pkt_count = 0
        try:
            while True:
                raw = await telnyx_ws.receive_text()
                message = media_handler.parse_message(raw)

                if pkt_count < 3:
                    logger.info(
                        f"Telnyx msg #{pkt_count} ({state.call_id}): {raw[:500]}"
                    )

                if media_handler.is_stop_event(message):
                    logger.info(f"Phone hangup for call {state.call_id}")
                    break

                audio = media_handler.extract_audio(message)
                if audio:
                    pkt_count += 1
                    pcm = l16_to_pcm_le(audio)
                    await gemini_session.send_realtime_input(
                        audio=types.Blob(
                            data=pcm, mime_type="audio/pcm;rate=16000"
                        )
                    )
                    if pkt_count % 100 == 0:
                        logger.info(
                            f"Phone→Gemini: {pkt_count} packets ({state.call_id})"
                        )
                elif message.get("event") == "media":
                    if pkt_count == 0:
                        logger.warning(
                            f"Media event but no audio extracted ({state.call_id}): {raw[:300]}"
                        )
        except Exception as e:
            logger.error(f"phone_to_gemini error ({state.call_id}): {e}")

    async def gemini_to_phone():
        """Forward Gemini audio to phone. PCM 24kHz LE → resample 16kHz → L16 BE."""
        pkt_count = 0
        try:
            async for response in gemini_session.receive():
                if pkt_count < 3:
                    logger.info(
                        f"Gemini response ({state.call_id}): "
                        f"data={len(response.data) if response.data else 0}B, "
                        f"server_content={response.server_content is not None}, "
                        f"text={response.text if hasattr(response, 'text') and response.text else None}"
                    )

                # Check max duration
                if (
                    state.connected_time
                    and time.time() - state.connected_time > MAX_CALL_DURATION
                ):
                    logger.info(
                        f"Max duration reached for call {state.call_id}"
                    )
                    break

                # Audio data from Gemini
                if response.data:
                    pkt_count += 1
                    audio_16k = resample_audio(response.data, 24000, 16000)
                    audio_l16 = pcm_le_to_l16(audio_16k)
                    message = media_handler.format_audio_message(audio_l16)
                    await telnyx_ws.send_text(message)
                    if pkt_count <= 3 or pkt_count % 100 == 0:
                        logger.info(
                            f"Gemini→Phone: pkt {pkt_count}, {len(response.data)} bytes ({state.call_id})"
                        )

                # Transcriptions
                if response.server_content:
                    sc = response.server_content

                    if (
                        hasattr(sc, "output_transcription")
                        and sc.output_transcription
                        and sc.output_transcription.text
                    ):
                        entry = {
                            "speaker": "agent",
                            "text": sc.output_transcription.text,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                        state.transcript.append(entry)
                        await send_callback(
                            state.callback_url,
                            "transcript_update",
                            state.call_id,
                            bridge_secret,
                            transcript_entry=entry,
                        )

                    if (
                        hasattr(sc, "input_transcription")
                        and sc.input_transcription
                        and sc.input_transcription.text
                    ):
                        entry = {
                            "speaker": "callee",
                            "text": sc.input_transcription.text,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                        state.transcript.append(entry)
                        await send_callback(
                            state.callback_url,
                            "transcript_update",
                            state.call_id,
                            bridge_secret,
                            transcript_entry=entry,
                        )
        except Exception as e:
            logger.error(f"gemini_to_phone error ({state.call_id}): {e}")

    # Run both directions concurrently
    done, pending = await asyncio.wait(
        [
            asyncio.create_task(phone_to_gemini()),
            asyncio.create_task(gemini_to_phone()),
        ],
        return_when=asyncio.FIRST_COMPLETED,
    )

    # Cancel the remaining task
    for task in pending:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


async def _complete_call(
    call_id: str, bridge_secret: str, failed: bool = False
):
    """Clean up a call and send the completion callback."""
    state = active_calls.pop(call_id, None)
    if not state:
        return

    if state.status == "completed" or state.status == "failed":
        return

    duration = 0
    if state.connected_time:
        duration = int(time.time() - state.connected_time)

    summary = ""
    if not failed and state.transcript:
        try:
            client = create_gemini_client()
            summary = await generate_summary(client, state.transcript)
        except Exception as e:
            logger.error(f"Summary generation failed for {call_id}: {e}")
            summary = "Call completed but summary generation failed."

    state.status = "failed" if failed else "completed"

    await send_callback(
        state.callback_url,
        "call_completed",
        call_id,
        bridge_secret,
        status=state.status,
        summary=summary,
        duration_seconds=duration,
        transcript=state.transcript,
    )


async def end_call(call_id: str, bridge_secret: str):
    """End a call by user request."""
    state = active_calls.get(call_id)
    if not state:
        return

    # Try to hang up via Telnyx
    if state.telnyx_call_control_id:
        try:
            await hangup_call(state.telnyx_call_control_id)
        except Exception as e:
            logger.error(f"Telnyx hangup failed for {call_id}: {e}")

    await _complete_call(call_id, bridge_secret)
