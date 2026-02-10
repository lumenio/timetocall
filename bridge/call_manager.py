import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import numpy as np
import httpx
from google.genai import types
from fastapi import WebSocket

from audio_utils import l16_to_pcm_le, pcm_le_to_l16, resample_audio, chunk_audio, ulaw_to_pcm
from gemini_bridge import (
    build_system_prompt,
    create_gemini_config,
    create_gemini_client,
    generate_summary,
    MODEL,
)
from telnyx_handler import TelnyxMediaHandler, initiate_call, start_streaming, hangup_call

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
    bridge_public_url: str = ""
    status: str = "pending"
    telnyx_call_control_id: str = ""
    transcript: list[dict] = field(default_factory=list)
    start_time: float = 0.0
    connected_time: float = 0.0
    answer_event: asyncio.Event = field(default_factory=asyncio.Event)
    gemini_session: Any = None       # Gemini Live session (persists across WS reconnects)
    _gemini_ctx: Any = None          # Context manager ref for cleanup


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
        bridge_public_url=bridge_public_url,
        start_time=time.time(),
    )
    active_calls[call_id] = state

    webhook_url = f"https://{bridge_public_url}/telnyx/webhook"
    logger.info(f"Telnyx webhook_url: {webhook_url}")

    try:
        call_control_id = await initiate_call(phone_number, webhook_url)
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


async def handle_call_answered(call_id: str, bridge_secret: str):
    """Called when Telnyx call.answered webhook arrives.

    Sets the answer event and starts audio streaming on the now-active call.
    Streaming is started here (not in the dial request) so that we capture
    real call audio instead of silence from the ringing phase.
    """
    state = active_calls.get(call_id)
    if not state:
        return

    state.answer_event.set()
    logger.info(f"Call answered: {call_id}")

    stream_url = f"wss://{state.bridge_public_url}/telnyx/media-stream?call_id={call_id}"
    try:
        await start_streaming(state.telnyx_call_control_id, stream_url)
    except Exception as e:
        logger.error(f"start_streaming failed for {call_id}: {e}")
        await _complete_call(call_id, bridge_secret, failed=True)
        return
    logger.info(f"Call answered and streaming started: {call_id}")


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

    Telnyx may cycle the WebSocket connection multiple times during a call.
    The Gemini Live session is persisted on CallState so it survives WS
    reconnections — only the first WS connection creates the session.
    """
    state = active_calls.get(call_id)
    if not state:
        logger.error(f"No active call found for {call_id}")
        await websocket.close()
        return

    logger.info(
        f"WS handler for {call_id}, answered={state.answer_event.is_set()}, "
        f"has_gemini={state.gemini_session is not None}"
    )

    # Wait for answer event if not yet set
    if not state.answer_event.is_set():
        logger.info(f"WS connected before answer event set for {call_id}, waiting...")
        try:
            await asyncio.wait_for(state.answer_event.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning(f"Answer event timeout on WS for {call_id}, proceeding anyway")

    first_connection = state.gemini_session is None

    if first_connection:
        # First WS connection: create Gemini session and send initial prompt
        state.status = "connected"
        state.connected_time = time.time()

        await send_callback(
            state.callback_url,
            "status_update",
            call_id,
            bridge_secret,
            status="connected",
        )

        # Build persistent Gemini session (NOT using `async with` so it survives WS reconnects)
        system_prompt = build_system_prompt(
            state.briefing, state.user_name, state.language
        )
        config = create_gemini_config(system_prompt)
        client = create_gemini_client()

        try:
            ctx = client.aio.live.connect(model=MODEL, config=config)
            state.gemini_session = await ctx.__aenter__()
            state._gemini_ctx = ctx
            logger.info(f"Gemini Live session connected for call {call_id}")

            # Trigger Gemini to start the conversation
            await state.gemini_session.send_client_content(
                turns=types.Content(
                    role="user",
                    parts=[types.Part(text="The phone call is now connected. The other person has answered. Begin the conversation now.")],
                ),
                turn_complete=True,
            )
            logger.info(f"Sent initial prompt to Gemini for call {call_id}")
        except Exception as e:
            logger.error(f"Gemini session creation error for call {call_id}: {e}")
            # Clean up partial state
            state.gemini_session = None
            state._gemini_ctx = None
            return
    else:
        # WS reconnection: reuse existing Gemini session
        logger.info(f"WS reconnect for {call_id}, reusing existing Gemini session")

    try:
        await _bridge_audio(websocket, state.gemini_session, state, bridge_secret)
    except Exception as e:
        logger.error(f"Bridge error for call {call_id}: {e}")
    # NOTE: No _complete_call here. The hangup webhook handles call completion.


async def _bridge_audio(
    telnyx_ws: WebSocket,
    gemini_session,
    state: CallState,
    bridge_secret: str,
):
    """Bridge audio between Telnyx WebSocket and Gemini Live API session."""
    media_handler = TelnyxMediaHandler()

    # Shared between coroutines so gemini_to_phone can use detected sample rate
    stream_info = {"sample_rate": 16000, "codec": "L16"}

    async def phone_to_gemini():
        """Forward phone audio to Gemini with codec detection and diagnostics."""
        pkt_count = 0
        try:
            while True:
                raw = await telnyx_ws.receive_text()
                message = media_handler.parse_message(raw)

                if pkt_count < 3:
                    logger.info(
                        f"Telnyx msg #{pkt_count} ({state.call_id}): {raw[:500]}"
                    )

                # Parse start event for actual codec/format info
                fmt = media_handler.extract_media_format(message)
                if fmt:
                    stream_info["codec"] = fmt.get("encoding", stream_info["codec"])
                    stream_info["sample_rate"] = fmt.get("sample_rate", stream_info["sample_rate"])
                    logger.info(
                        f"Telnyx stream format: encoding={stream_info['codec']} "
                        f"sample_rate={stream_info['sample_rate']} ({state.call_id})"
                    )
                    continue

                if media_handler.is_stop_event(message):
                    logger.info(f"Phone hangup for call {state.call_id}")
                    break

                audio = media_handler.extract_audio(message)
                if audio:
                    pkt_count += 1

                    # Convert to PCM LE 16kHz based on detected codec
                    if stream_info["codec"] == "PCMU":
                        pcm = ulaw_to_pcm(audio)
                        if stream_info["sample_rate"] != 16000:
                            pcm = resample_audio(pcm, stream_info["sample_rate"], 16000)
                    else:
                        # L16 — passthrough (already little-endian in practice)
                        pcm = l16_to_pcm_le(audio)
                        if stream_info["sample_rate"] != 16000:
                            pcm = resample_audio(pcm, stream_info["sample_rate"], 16000)

                    # Audio amplitude diagnostics every 50 packets
                    if pkt_count % 50 == 1:
                        samples = np.frombuffer(pcm, dtype=np.int16)
                        if len(samples) > 0:
                            rms = int(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))
                            logger.info(
                                f"Phone audio stats pkt#{pkt_count} ({state.call_id}): "
                                f"min={samples.min()} max={samples.max()} rms={rms} "
                                f"bytes={len(pcm)} codec={stream_info['codec']}"
                            )

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
                    target_rate = stream_info["sample_rate"]
                    audio_resampled = resample_audio(response.data, 24000, target_rate)
                    audio_l16 = pcm_le_to_l16(audio_resampled)
                    # Dynamic chunk size: 20ms at target_rate (samples * 2 bytes)
                    chunk_bytes = int(target_rate * 0.02) * 2
                    chunks = chunk_audio(audio_l16, chunk_size=chunk_bytes)
                    for ch in chunks:
                        message = media_handler.format_audio_message(ch)
                        await telnyx_ws.send_text(message)
                    if pkt_count <= 3 or pkt_count % 100 == 0:
                        logger.info(
                            f"Gemini→Phone: pkt {pkt_count}, {len(response.data)} bytes, "
                            f"{len(chunks)} chunks ({state.call_id})"
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

    # Clean up persistent Gemini session
    if state._gemini_ctx:
        try:
            await state._gemini_ctx.__aexit__(None, None, None)
            logger.info(f"Gemini session closed for call {call_id}")
        except Exception as e:
            logger.warning(f"Gemini session cleanup error for {call_id}: {e}")
        state.gemini_session = None
        state._gemini_ctx = None

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
