const BRIDGE_URL = process.env.AUDIO_BRIDGE_URL || "http://localhost:8080";
const BRIDGE_SECRET = process.env.AUDIO_BRIDGE_SECRET || "";

export async function bridgeRequest(
  path: string,
  body: Record<string, unknown>
) {
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BRIDGE_SECRET}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Bridge request failed (${res.status}): ${text}`);
  }

  return res.json();
}
