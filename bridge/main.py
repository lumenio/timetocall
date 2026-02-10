import os
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from telnyx_handler import init_telnyx
import call_manager

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
    init_telnyx()
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
    logger.info(f"Telnyx webhook: {body}")
    return {"status": "ok"}
