import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bridgeRequest, BridgeError } from "@/lib/api";
import { validatePhoneNumber, validateBriefing } from "@/lib/validators";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { briefing, phoneNumber, language = "auto" } = body;

  // Validate inputs
  const briefingCheck = validateBriefing(briefing || "");
  if (!briefingCheck.valid) {
    return NextResponse.json({ error: briefingCheck.error }, { status: 400 });
  }

  const phoneCheck = validatePhoneNumber(phoneNumber || "");
  if (!phoneCheck.valid) {
    return NextResponse.json({ error: phoneCheck.error }, { status: 400 });
  }

  // Check credits
  const { data: userData } = await supabase
    .from("users")
    .select("credits, name")
    .eq("id", user.id)
    .single();

  if (!userData || userData.credits < 1) {
    return NextResponse.json(
      { error: "Insufficient credits" },
      { status: 402 }
    );
  }

  // Rate limit: max 5 calls per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= 50) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 50 calls per hour." },
      { status: 429 }
    );
  }

  // Deduct credit atomically
  const { data: updated, error: creditError } = await supabase.rpc(
    "deduct_credit",
    { user_id: user.id }
  );

  // Fallback if RPC doesn't exist: use direct update
  if (creditError) {
    const { error: updateError } = await supabase
      .from("users")
      .update({ credits: userData.credits - 1 })
      .eq("id", user.id)
      .gte("credits", 1);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to deduct credit" },
        { status: 500 }
      );
    }
  }

  // Create call record
  const { data: call, error: callError } = await supabase
    .from("calls")
    .insert({
      user_id: user.id,
      phone_number: phoneNumber,
      briefing,
      preferred_language: language,
      status: "pending",
      cost_credits: 1,
    })
    .select("id")
    .single();

  if (callError || !call) {
    // Refund credit
    await supabase
      .from("users")
      .update({ credits: userData.credits })
      .eq("id", user.id);
    return NextResponse.json(
      { error: "Failed to create call" },
      { status: 500 }
    );
  }

  // Send to bridge
  try {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await bridgeRequest("/start-call", {
      call_id: call.id,
      phone_number: phoneNumber,
      briefing,
      language,
      user_name: userData.name || user.email?.split("@")[0] || "the user",
      callback_url: `${appUrl}/api/webhooks/bridge`,
    });

    // Update status to dialing
    await supabase
      .from("calls")
      .update({ status: "dialing" })
      .eq("id", call.id);
  } catch (err) {
    // Refund credit and mark failed
    await supabase
      .from("users")
      .update({ credits: userData.credits })
      .eq("id", user.id);
    await supabase
      .from("calls")
      .update({ status: "failed" })
      .eq("id", call.id);

    if (err instanceof BridgeError && err.status === 422) {
      return NextResponse.json(
        { error: err.detail },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "Failed to start call. The audio bridge may be unavailable." },
      { status: 502 }
    );
  }

  return NextResponse.json({ callId: call.id }, { status: 201 });
}
