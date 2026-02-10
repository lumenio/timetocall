import audioop

import numpy as np
from scipy.signal import resample

# 20ms at 16kHz, 16-bit mono = 320 samples * 2 bytes = 640 bytes
TELNYX_CHUNK_BYTES = 640


def ulaw_to_pcm(data: bytes) -> bytes:
    """Decode G.711 µ-law to 16-bit linear PCM (little-endian)."""
    return audioop.ulaw2lin(data, 2)


def l16_to_pcm_le(data: bytes) -> bytes:
    """Telnyx L16 over WebSocket is already little-endian in practice. No conversion needed."""
    return data


def pcm_le_to_l16(data: bytes) -> bytes:
    """Telnyx accepts little-endian PCM directly. No conversion needed."""
    return data


def chunk_audio(audio_bytes: bytes, chunk_size: int = TELNYX_CHUNK_BYTES) -> list[bytes]:
    """Split audio into RTP-sized chunks for Telnyx (default 640 bytes = 20ms at 16kHz)."""
    return [audio_bytes[i:i + chunk_size] for i in range(0, len(audio_bytes), chunk_size)]


def resample_audio(audio_bytes: bytes, from_rate: int, to_rate: int) -> bytes:
    """Resample PCM 16-bit little-endian audio between sample rates."""
    if not audio_bytes or from_rate == to_rate:
        return audio_bytes
    samples = np.frombuffer(audio_bytes, dtype=np.int16)
    if len(samples) == 0:
        return b""
    num_samples = int(len(samples) * to_rate / from_rate)
    resampled = resample(samples, num_samples).astype(np.int16)
    return resampled.tobytes()
