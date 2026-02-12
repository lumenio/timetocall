const BRIDGE_URL = process.env.AUDIO_BRIDGE_URL || "http://localhost:8080";
const BRIDGE_SECRET = process.env.AUDIO_BRIDGE_SECRET || "";

export class BridgeError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`Bridge request failed (${status}): ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

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
    let detail = "";
    try {
      const json = await res.json();
      detail = json.detail || JSON.stringify(json);
    } catch {
      detail = await res.text().catch(() => "Unknown error");
    }
    throw new BridgeError(res.status, detail);
  }

  return res.json();
}
