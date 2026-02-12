import os
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import call_manager
from gemini_bridge import create_gemini_client, moderate_briefing

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

BRIDGE_SECRET = os.getenv("AUDIO_BRIDGE_SECRET", "")
BRIDGE_PUBLIC_URL = os.getenv("BRIDGE_PUBLIC_URL", "localhost:8080")

app = FastAPI(title="TimeToCall Audio Bridge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CALLBACK_BASE_URL", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_auth(request: Request):
    auth = request.headers.get("authorization", "")
    if auth != f"Bearer {BRIDGE_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.on_event("startup")
async def startup():
    # Log masked env vars for debugging config issues
    conn_id = os.environ.get("TELNYX_CONNECTION_ID", "")
    phone = os.environ.get("TELNYX_PHONE_NUMBER", "")
    api_key = os.environ.get("TELNYX_API_KEY", "")
    logger.info(
        f"Telnyx config: connection_id={conn_id[:8]}... "
        f"phone={phone} "
        f"api_key={'set' if api_key else 'MISSING'}"
    )
    logger.info(f"Bridge public URL: {BRIDGE_PUBLIC_URL}")
    logger.info("Audio bridge server started")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/start-call")
async def start_call(request: Request):
    verify_auth(request)
    body = await request.json()

    required = ["call_id", "phone_number", "briefing", "callback_url"]
    for field in required:
        if field not in body:
            raise HTTPException(status_code=400, detail=f"Missing {field}")

    # Content moderation check
    try:
        rejection = await moderate_briefing(create_gemini_client(), body["briefing"])
        if rejection:
            logger.warning(f"Briefing rejected for {body['call_id']}: {rejection}")
            raise HTTPException(status_code=422, detail=f"Briefing rejected: {rejection}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Moderation check failed, allowing call: {e}")

    try:
        call_control_id = await call_manager.start_call(
            call_id=body["call_id"],
            phone_number=body["phone_number"],
            briefing=body["briefing"],
            language=body.get("language", "auto"),
            user_name=body.get("user_name", "the user"),
            callback_url=body["callback_url"],
            bridge_public_url=BRIDGE_PUBLIC_URL,
            bridge_secret=BRIDGE_SECRET,
        )
        return {"status": "ok", "telnyx_call_control_id": call_control_id}
    except Exception as e:
        logger.error(f"start_call error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/end-call")
async def end_call(request: Request):
    verify_auth(request)
    body = await request.json()

    call_id = body.get("call_id")
    if not call_id:
        raise HTTPException(status_code=400, detail="Missing call_id")

    await call_manager.end_call(call_id, BRIDGE_SECRET)
    return {"status": "ok"}


@app.websocket("/telnyx/media-stream")
async def telnyx_media_stream(websocket: WebSocket, call_id: str = ""):
    if not call_id:
        await websocket.close(code=1008, reason="Missing call_id")
        return

    await websocket.accept()
    logger.info(f"Telnyx WebSocket connected for call {call_id}")

    try:
        await call_manager.handle_telnyx_websocket(
            websocket, call_id, BRIDGE_SECRET
        )
    except Exception as e:
        logger.error(f"WebSocket error for call {call_id}: {e}")
    finally:
        logger.info(f"Telnyx WebSocket closed for call {call_id}")


@app.post("/telnyx/webhook")
async def telnyx_webhook(request: Request):
    """Handle Telnyx call status webhooks."""
    body = await request.json()
    event_type = body.get("data", {}).get("event_type", "")
    payload = body.get("data", {}).get("payload", {})
    call_control_id = payload.get("call_control_id", "")

    logger.info(f"Telnyx webhook: {event_type} for {call_control_id}")

    if event_type == "call.answered":
        state = call_manager.find_call_by_telnyx_id(call_control_id)
        if state:
            await call_manager.handle_call_answered(state.call_id, BRIDGE_SECRET)
        else:
            logger.warning(f"call.answered for unknown call_control_id: {call_control_id}")

    elif event_type == "call.hangup":
        state = call_manager.find_call_by_telnyx_id(call_control_id)
        if state:
            await call_manager.handle_call_hangup(state.call_id, BRIDGE_SECRET)
        else:
            logger.warning(f"call.hangup for unknown call_control_id: {call_control_id}")

    return {"status": "ok"}
