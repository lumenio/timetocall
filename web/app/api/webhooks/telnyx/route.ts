import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();

  // Log Telnyx webhook events for debugging
  console.log("[Telnyx Webhook]", JSON.stringify(body, null, 2));

  return NextResponse.json({ ok: true });
}
