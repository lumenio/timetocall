import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bridgeRequest } from "@/lib/api";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify call exists and belongs to user
  const { data: call } = await supabase
    .from("calls")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  if (call.status === "completed" || call.status === "failed") {
    return NextResponse.json({ error: "Call already ended" }, { status: 400 });
  }

  try {
    await bridgeRequest("/end-call", { call_id: id });
  } catch {
    // Even if bridge fails, mark the call as completed
  }

  await supabase
    .from("calls")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
