import os
from google import genai
from google.genai import types

MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"
SUMMARY_MODEL = "gemini-2.0-flash"


def build_system_prompt(briefing: str, user_name: str, language: str) -> str:
    lang_instruction = (
        f"Speak in {language}."
        if language != "auto"
        else "Speak in the language that the person on the other end uses."
    )

    return f"""You are a phone agent calling on behalf of someone. You are making an outbound call to accomplish a specific task.

TASK:
{briefing}

IDENTITY:
- Your name is not important. If asked who you are, say you are calling on behalf of {user_name}.
- Do not reveal you are an AI unless directly and explicitly asked.

CONVERSATION FLOW:
1. Greet briefly. State why you are calling in one sentence.
2. Use ONLY the details from the TASK above. You already have all the information from the person you represent — do NOT ask the callee for details that are already in the TASK.
3. If the callee needs info not covered in the TASK, say you will check and get back to them.
4. Once the task is done, repeat back the key details to confirm, then end the call politely.

RULES:
- Speak naturally in short sentences. Do not monologue.
- {lang_instruction}
- Stay on topic. Do not go off-topic or make small talk beyond a brief greeting.
- If you cannot accomplish the task, gather as much useful information as possible.
- Keep the call under 5 minutes. If it's going longer, wrap up."""


def create_gemini_config(system_prompt: str) -> types.LiveConnectConfig:
    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=types.Content(
            parts=[types.Part(text=system_prompt)]
        ),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Kore"
                )
            )
        ),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=False,
                start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                prefix_padding_ms=100,
                silence_duration_ms=300,
            )
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )


def create_gemini_client() -> genai.Client:
    return genai.Client(api_key=os.environ["GOOGLE_API_KEY"])


async def generate_summary(
    client: genai.Client, transcript: list[dict]
) -> str:
    """Generate a call summary from the transcript using a text model."""
    if not transcript:
        return "No conversation was recorded."

    transcript_text = "\n".join(
        f"{'AI Agent' if e['speaker'] == 'agent' else 'Callee'}: {e['text']}"
        for e in transcript
    )

    response = await client.aio.models.generate_content(
        model=SUMMARY_MODEL,
        contents=(
            "Summarize this phone call transcript concisely. "
            "Focus on outcomes, decisions made, and any action items or "
            "follow-ups. Keep it to 2-3 sentences.\n\n"
            f"Transcript:\n{transcript_text}"
        ),
    )
    return response.text or "Call completed."
