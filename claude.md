# timetocall — AI Phone Agent

> "Hate making phone calls? We got you."

## Project Overview

TimeToCall is a web app that makes phone calls on the user's behalf using an AI voice agent. The user types what they need, provides a phone number, and the AI agent calls, handles the conversation, and reports back with a summary.

**Core use cases:**
- User doesn't want to call (anxiety, convenience)
- User doesn't speak the language (restaurant in Tokyo, mechanic in Berlin)
- User wants to save time (checking availability, prices, booking)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router), React, TypeScript, Tailwind CSS |
| AI Voice Engine | Google Gemini Live API (`gemini-2.5-flash-native-audio-preview-12-2025`) |
| Telephony | Telnyx (primary) or Twilio (fallback) |
| Backend | Next.js API routes + separate Python server for audio bridge |
| Audio Bridge | Python (Quart or FastAPI) — bridges Telnyx/Twilio WebSocket ↔ Gemini Live API WebSocket |
| Database | Supabase (Postgres) — users, call logs, transcripts |
| Auth | Supabase Auth (magic link or OAuth) |
| Payments | Stripe (credit-based model) |
| Hosting | Vercel (Next.js frontend) + Railway/Fly.io (Python audio bridge) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER (Browser)                        │
│                                                         │
│  1. Types briefing prompt ("Book a table for 2...")      │
│  2. Enters phone number (+33 1 42 86 87 88)            │
│  3. Hits "Make the Call"                                │
│  4. Watches live status / reads transcript after        │
└──────────────────┬──────────────────────────────────────┘
                   │ POST /api/calls
                   ▼
┌──────────────────────────────────────────────────────────┐
│              NEXT.JS BACKEND (Vercel)                     │
│                                                          │
│  - Validates input, deducts credit                       │
│  - Sends request to Python Audio Bridge server           │
│  - Stores call record in Supabase                        │
│  - Returns call ID for polling / WebSocket status        │
└──────────────────┬───────────────────────────────────────┘
                   │ POST /start-call
                   ▼
┌──────────────────────────────────────────────────────────┐
│           PYTHON AUDIO BRIDGE SERVER                      │
│           (Railway / Fly.io)                              │
│                                                          │
│  1. Initiates outbound call via Telnyx/Twilio API        │
│  2. Telnyx answers → opens WebSocket with                │
│     bidirectional audio stream (L16 raw PCM, 16kHz)      │
│  3. Opens Gemini Live API WebSocket session              │
│  4. BRIDGES audio:                                       │
│     Phone audio (L16 PCM 16kHz) → Gemini Live API input  │
│       (direct passthrough, zero conversion)              │
│     Gemini audio output (PCM 24kHz) → resample to 16kHz │
│       → Telnyx L16 stream → Phone audio                  │
│  5. Gemini handles full conversation using system prompt │
│  6. Streams transcription back to Next.js via callback   │
│  7. On call end → sends final summary + transcript       │
└──────────────────────────────────────────────────────────┘
```

### Audio Flow Detail

Telnyx supports the L16 codec — raw linear PCM at 16kHz. This is exactly what Gemini Live API expects as input, meaning **zero conversion on the input path**.

```
Phone Person speaks
    → Telnyx WebSocket (L16, raw PCM 16kHz) 
    → Gemini Live API (PCM 16kHz mono) ✅ zero conversion, direct passthrough

Gemini responds
    → Gemini Live API output (PCM 24kHz)
    → Resample 24kHz → 16kHz (one direction only, unavoidable)
    → Telnyx WebSocket (L16, PCM 16kHz) → Phone Person hears AI
```

**Important:** Configure Telnyx media streaming with `"stream_bidirectional_codec": "L16"` and 16kHz sample rate. L16 eliminates all codec encode/decode overhead — it's raw PCM end to end.

## App Flow & Pages

### 1. Landing Page (`/`)
- Hero: "Hate making phone calls? We got you."
- Subheading: "Any question. Any language. Just brief the agent, add a phone number, and get that long-awaited call done."
- CTA button → scrolls to call form or goes to `/call`
- How it works (3 steps): Brief → Call → Done
- Example use cases with icons

### 2. New Call Page (`/call`)
This is the main interaction page. Simple form:

**Briefing field** (textarea):
- Placeholder: "e.g., Book a table for 2 at 8pm this Friday. Ask if they have a terrace. My name is Slava."
- This becomes the system prompt for Gemini

**Phone number field** (input with country code picker):
- International format with validation
- Country code selector (default based on user locale)

**Language preference** (optional dropdown):
- "Auto-detect" (default — Gemini handles this natively)
- Or explicit: French, English, Spanish, Japanese, etc.

**"Make the Call" button**
- Shows estimated cost (1 credit ≈ 1 call up to 5 min)

### 3. Live Call Page (`/call/[id]`)
- Real-time call status: Dialing → Ringing → Connected → In Progress → Completed
- Live transcript (streamed via SSE or WebSocket from backend)
- Duration timer
- "End Call" button (emergency stop)
- On completion: summary card + full transcript + audio recording link

### 4. Call History (`/history`)
- List of past calls with status, duration, date
- Click to view transcript + summary

### 5. Auth & Account (`/login`, `/account`)
- Simple auth (magic link preferred for speed)
- Credit balance display
- Buy credits (Stripe checkout)

## Gemini Live API — System Prompt Construction

When initiating a Gemini Live session for a call, construct the system instruction from the user's briefing:

```
You are a phone agent making a call on behalf of a user. Your job is to accomplish the task described below.

TASK:
{user_briefing}

RULES:
- Be polite, natural, and human-like. Do not reveal you are AI unless directly asked.
- Stay focused on the task. Do not go off-topic.
- If you accomplish the task, confirm the details and politely end the call.
- If the person on the other end asks who you are, say you are calling on behalf of {user_name}.
- If you cannot accomplish the task, gather as much useful information as possible.
- Speak in the language that the person on the other end uses, or in {preferred_language} if specified.
- Keep the call under 5 minutes. If it's going longer, wrap up politely.
- After the call ends, you will provide a structured summary.
```

### Gemini Live API Config

```python
MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

config = {
    "response_modalities": ["AUDIO"],
    "system_instruction": system_prompt,  # constructed above
    "speech_config": {
        "voice_config": {
            "prebuilt_voice_config": {
                "voice_name": "Kore"  # or Puck, Aoede, etc.
            }
        }
    },
    "input_audio_transcription": {},   # enables transcription of phone person's speech
    "output_audio_transcription": {},  # enables transcription of AI's speech
}
```

Key Gemini Live API details:
- Connect via WebSocket: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`
- Input audio: PCM 16-bit, 16kHz, mono
- Output audio: PCM 24kHz (default)
- Has built-in VAD (Voice Activity Detection) — handles interruptions natively
- Supports 24+ languages with auto-detect
- Function calling is supported (can be used for future features like calendar booking)

## Telnyx Integration (Primary Telephony)

### Why Telnyx over Twilio
- Cheaper: $0.007/min vs Twilio's $0.014/min for voice
- **L16 codec support — raw PCM 16kHz** — direct passthrough to Gemini, zero codec overhead
- Free 24/7 engineering support
- WebSocket media streaming like Twilio

### Outbound Call Flow

```python
import telnyx

# 1. Create the call — use L16 codec for raw PCM 16kHz (direct Gemini compatibility)
call = telnyx.Call.create(
    connection_id="YOUR_TELNYX_CONNECTION_ID",
    to=phone_number,        # e.g., "+33142868788"
    from_=telnyx_number,    # your purchased Telnyx number
    webhook_url=f"{BASE_URL}/telnyx/webhook",
    stream_track="both_tracks",
    stream_url=f"wss://{BASE_URL}/telnyx/media-stream",
    stream_bidirectional_mode="rtp",
    stream_bidirectional_codec="L16",  # ← raw PCM, no codec overhead
)
```

### Telnyx WebSocket Media Stream
- Audio format: **L16 raw PCM, 16kHz, 16-bit, big-endian (network byte order)**
- Note: L16 uses big-endian per RFC 2586; Gemini expects little-endian — byte-swap needed
- Bidirectional: receive caller audio, send AI audio back
- Events: `media`, `start`, `stop`, `dtmf`
- No codec encode/decode overhead — just raw PCM samples

### Twilio Fallback (if Telnyx doesn't cover a region)

```python
from twilio.rest import Client

client = Client(TWILIO_SID, TWILIO_AUTH_TOKEN)

call = client.calls.create(
    to=phone_number,
    from_=twilio_number,
    twiml=f'''
    <Response>
        <Connect>
            <Stream url="wss://{BASE_URL}/twilio/media-stream" />
        </Connect>
    </Response>
    '''
)
```

Twilio Media Streams: G.711 µ-law 8kHz, base64-encoded JSON over WebSocket.

## Python Audio Bridge Server

This is the critical piece — a Python server (FastAPI or Quart) that:

1. Receives call request from Next.js backend
2. Initiates outbound call via Telnyx/Twilio
3. On call connect: opens two WebSocket connections simultaneously
   - One to Telnyx/Twilio (phone audio)
   - One to Gemini Live API (AI brain)
4. Bridges audio between them with format conversion
5. Streams transcription updates back to Next.js
6. On call end: generates summary, sends to Next.js

### Key Libraries

```
# requirements.txt
google-genai>=1.0.0        # Gemini SDK
telnyx>=2.0.0              # Telnyx SDK
twilio>=9.0.0              # Twilio SDK (fallback)
fastapi>=0.115.0
uvicorn>=0.30.0
websockets>=13.0
numpy                       # for byte-swap and audio resampling
scipy                       # for resampling (scipy.signal.resample)
```

### Audio Processing

With Telnyx L16, the input path is nearly a passthrough — just a byte-order swap. Only the output path needs resampling (Gemini 24kHz → 16kHz).

```python
import numpy as np
from scipy.signal import resample
import struct

def resample_audio(audio_bytes: bytes, from_rate: int, to_rate: int) -> bytes:
    """Resample PCM 16-bit audio. Only needed for Gemini output (24k→16k)."""
    samples = np.frombuffer(audio_bytes, dtype=np.int16)
    num_samples = int(len(samples) * to_rate / from_rate)
    resampled = resample(samples, num_samples).astype(np.int16)
    return resampled.tobytes()

def l16_to_pcm_le(data: bytes) -> bytes:
    """Convert L16 (big-endian per RFC 2586) to PCM little-endian for Gemini."""
    samples = np.frombuffer(data, dtype='>i2')  # big-endian int16
    return samples.astype('<i2').tobytes()        # little-endian int16

def pcm_le_to_l16(data: bytes) -> bytes:
    """Convert PCM little-endian (from Gemini) to L16 big-endian for Telnyx."""
    samples = np.frombuffer(data, dtype='<i2')  # little-endian int16
    return samples.astype('>i2').tobytes()        # big-endian int16
```

**Fallback for Twilio:** Twilio only supports G.711 µ-law at 8kHz, so the Twilio path needs full resampling both directions (8k↔16k input, 8k↔24k output) plus µ-law encode/decode via `audioop`.

### Bridge Pseudocode

```python
async def bridge_call(phone_ws, gemini_session):
    """Bridge audio between phone (Telnyx L16 16kHz) and Gemini Live API."""

    async def phone_to_gemini():
        """Forward phone audio to Gemini. L16 big-endian → PCM little-endian (byte swap only)."""
        async for message in phone_ws:
            audio_l16 = base64.b64decode(message["media"]["payload"])
            audio_pcm = l16_to_pcm_le(audio_l16)  # byte-swap, no resample
            await gemini_session.send_realtime_input(
                audio=types.Blob(data=audio_pcm, mime_type="audio/pcm;rate=16000")
            )

    async def gemini_to_phone():
        """Forward Gemini audio to phone. PCM 24kHz LE → resample 16kHz → L16 BE."""
        async for response in gemini_session.receive():
            if response.data:  # audio data
                audio_16k = resample_audio(response.data, 24000, 16000)
                audio_l16 = pcm_le_to_l16(audio_16k)
                await phone_ws.send(json.dumps({
                    "event": "media",
                    "media": {"payload": base64.b64encode(audio_l16).decode()}
                }))

            # Capture transcriptions for live display
            if response.server_content:
                if response.server_content.output_transcription:
                    await send_transcript_update(
                        speaker="agent",
                        text=response.server_content.output_transcription.text
                    )
                if response.server_content.input_transcription:
                    await send_transcript_update(
                        speaker="callee",
                        text=response.server_content.input_transcription.text
                    )

    await asyncio.gather(phone_to_gemini(), gemini_to_phone())
```

## Database Schema (Supabase)

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    credits INTEGER DEFAULT 3,  -- 3 free calls to start
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calls
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    phone_number TEXT NOT NULL,
    briefing TEXT NOT NULL,
    preferred_language TEXT DEFAULT 'auto',
    status TEXT DEFAULT 'pending',  -- pending, dialing, ringing, connected, completed, failed
    duration_seconds INTEGER,
    transcript JSONB,        -- [{speaker: "agent"|"callee", text: "...", timestamp: "..."}]
    summary TEXT,            -- AI-generated summary of outcomes
    recording_url TEXT,
    cost_credits INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

## Environment Variables

```env
# Gemini
GOOGLE_API_KEY=                    # Google AI API key for Gemini

# Telnyx (primary)
TELNYX_API_KEY=
TELNYX_CONNECTION_ID=
TELNYX_PHONE_NUMBER=               # purchased Telnyx number

# Twilio (fallback)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Audio Bridge Server
AUDIO_BRIDGE_URL=                  # URL of the Python server
AUDIO_BRIDGE_SECRET=               # shared secret for auth

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# App
NEXT_PUBLIC_APP_URL=               # e.g., https://timetocall.app
```

## Project Structure

```
timetocall/
├── web/                           # Next.js app
│   ├── app/
│   │   ├── page.tsx               # Landing page
│   │   ├── call/
│   │   │   ├── page.tsx           # New call form
│   │   │   └── [id]/
│   │   │       └── page.tsx       # Live call view + results
│   │   ├── history/
│   │   │   └── page.tsx           # Call history
│   │   ├── login/
│   │   │   └── page.tsx           # Auth page
│   │   ├── account/
│   │   │   └── page.tsx           # Account + credits
│   │   └── api/
│   │       ├── calls/
│   │       │   ├── route.ts       # POST: initiate call
│   │       │   └── [id]/
│   │       │       └── route.ts   # GET: call status/transcript
│   │       ├── webhooks/
│   │       │   ├── telnyx/
│   │       │   │   └── route.ts   # Telnyx status webhooks
│   │       │   └── stripe/
│   │       │       └── route.ts   # Stripe payment webhooks
│   │       └── credits/
│   │           └── route.ts       # POST: buy credits
│   ├── components/
│   │   ├── CallForm.tsx           # Briefing + phone number form
│   │   ├── LiveCallView.tsx       # Real-time call status + transcript
│   │   ├── CallCard.tsx           # Call history card
│   │   ├── PhoneInput.tsx         # Phone number input with country code
│   │   ├── CreditBadge.tsx        # Shows credit balance
│   │   └── Navbar.tsx
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client
│   │   ├── stripe.ts              # Stripe helpers
│   │   └── api.ts                 # API client helpers
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── bridge/                         # Python audio bridge server
│   ├── main.py                     # FastAPI app entry point
│   ├── gemini_bridge.py            # Gemini Live API session management
│   ├── telnyx_handler.py           # Telnyx call + WebSocket handling
│   ├── twilio_handler.py           # Twilio call + WebSocket handling (fallback)
│   ├── audio_utils.py              # Resampling, µ-law encode/decode
│   ├── call_manager.py             # Orchestrates full call lifecycle
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
│
├── claude.md                       # This file
└── README.md
```

## Design Guidelines

### Visual Style
- Clean, modern, minimal — think Linear/Vercel aesthetic
- Dark mode preferred (with light mode toggle)
- Primary color: electric blue (#3B82F6) or vibrant indigo
- Accent: green for success states, amber for in-progress
- Font: Inter or system font stack
- Generous whitespace, large type for hero sections
- Subtle animations (Framer Motion) for state transitions

### Landing Page Vibe
- Confident, slightly playful tone
- Hero should feel empowering — "you don't have to do this anymore"
- Show a mock phone UI or waveform animation
- Social proof section (when applicable)
- "How it works" as 3 clean steps with icons:
  1. 📝 Brief — Tell us what you need
  2. 📞 Call — AI calls on your behalf
  3. ✅ Done — Get a summary of what happened

### UX Principles
- Entire call flow should feel like < 30 seconds of user effort
- No unnecessary steps or fields
- Phone number input must be forgiving (accept various formats)
- Show live feedback during call (don't leave user in the dark)
- Mobile-first responsive design

## Key Implementation Notes

### Audio Bridge is the Hard Part
The Python audio bridge server is the most complex piece. It must:
- Handle async bidirectional WebSocket streams concurrently
- Resample audio in real-time with minimal latency
- Handle call events (answered, hangup, error, timeout)
- Recover gracefully from Gemini disconnections
- Buffer audio appropriately (too little = choppy, too much = laggy)

### Latency Budget
Target: < 800ms voice-to-voice
- Telnyx network: ~50ms
- L16 byte-swap (no codec, no resample): ~1ms
- Gemini processing: ~200-400ms
- Resample 24k→16k + byte-swap: ~5ms
- Telnyx network back: ~50ms
- **Total: ~306-506ms** ✅ well within budget

L16 is the fastest possible path — no codec encode/decode, no resampling on input.

### Error Handling
- If Gemini disconnects mid-call → attempt reconnect, if fails → end call gracefully
- If phone line drops → clean up Gemini session
- If call goes to voicemail → detect (long silence / beep) → leave brief message and hang up
- If no answer after 30s → hang up, report to user
- If number is invalid → fail fast before initiating call

### Rate Limiting & Abuse Prevention
- Require auth for all calls
- Rate limit: max 5 calls per hour per user
- Credit system prevents unlimited use
- Log all calls for abuse review
- Block premium/toll numbers

### Regulatory Considerations
- Comply with TCPA (US), GDPR (EU) for call recording
- Disclose AI agent status if legally required in jurisdiction
- Store recordings encrypted, auto-delete after 30 days
- Allow users to delete their call data

## MVP Scope (v0.1)

Build these first, skip the rest:

1. ✅ Landing page with hero + CTA
2. ✅ Call form (briefing + phone number)
3. ✅ Python bridge: Telnyx → Gemini Live API → Telnyx
4. ✅ Basic call status page (polling, not WebSocket)
5. ✅ Post-call transcript + summary display
6. ✅ Supabase auth (magic link)
7. ✅ 3 free credits, no payment yet

### Skip for MVP:
- ❌ Stripe payments
- ❌ Twilio fallback
- ❌ Call recording/playback
- ❌ Real-time transcript streaming (use polling)
- ❌ Call history page (just show last call)
- ❌ Dark mode toggle (pick one and ship)

## Commands

```bash
# Frontend
cd web && npm install && npm run dev

# Audio Bridge
cd bridge && pip install -r requirements.txt && uvicorn main:app --reload --port 8080

# Expose bridge for Telnyx webhooks (dev)
ngrok http 8080
```

## Future Features (Post-MVP)

- Real-time transcript streaming (WebSocket from bridge → frontend)
- Multi-call: call 3 restaurants and compare answers
- Calendar integration: auto-book confirmed appointments
- Call recording playback
- Voice selection (let user pick Gemini voice)
- SMS follow-up: send confirmation text after booking
- Scheduled calls: "call them tomorrow at 9am"
- Mobile app (React Native / Expo)
- Concurrent call limit increase for paid plans
