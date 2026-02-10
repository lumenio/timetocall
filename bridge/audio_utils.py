import numpy as np
from scipy.signal import resample


def l16_to_pcm_le(data: bytes) -> bytes:
    """Convert L16 (big-endian per RFC 2586) to PCM little-endian for Gemini."""
    if not data:
        return b""
    samples = np.frombuffer(data, dtype=">i2")  # big-endian int16
    return samples.astype("<i2").tobytes()  # little-endian int16


def pcm_le_to_l16(data: bytes) -> bytes:
    """Convert PCM little-endian (from Gemini) to L16 big-endian for Telnyx."""
    if not data:
        return b""
    samples = np.frombuffer(data, dtype="<i2")  # little-endian int16
    return samples.astype(">i2").tobytes()  # big-endian int16


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
