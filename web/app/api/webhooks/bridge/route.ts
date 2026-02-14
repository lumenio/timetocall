import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  // Verify shared secret
  const auth = request.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.AUDIO_BRIDGE_SECRET}`;
  if (auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { call_id, event } = body;

  if (!call_id || !event) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event) {
    case "status_update": {
      const { status } = body;
      const update: Record<string, unknown> = { status };
      if (status === "completed" || status === "failed") {
        update.completed_at = new Date().toISOString();
      }
      await supabase.from("calls").update(update).eq("id", call_id);
      break;
    }

    case "transcript_update": {
      const { transcript_entry } = body;
      if (transcript_entry) {
        // Append to transcript JSONB array
        const { data: call } = await supabase
          .from("calls")
          .select("transcript")
          .eq("id", call_id)
          .single();

        const existing = call?.transcript || [];
        await supabase
          .from("calls")
          .update({ transcript: [...existing, transcript_entry] })
          .eq("id", call_id);
      }
      break;
    }

    case "call_completed": {
      const { summary, duration_seconds, transcript, status } = body;
      const isFailed = status === "failed";
      const update: Record<string, unknown> = {
        status: isFailed ? "failed" : "completed",
        completed_at: new Date().toISOString(),
      };
      if (summary) update.summary = summary;
      if (duration_seconds) update.duration_seconds = duration_seconds;
      if (transcript) update.transcript = transcript;
      await supabase.from("calls").update(update).eq("id", call_id);

      // Refund credit if call never connected
      if (isFailed) {
        const { data: call } = await supabase
          .from("calls")
          .select("user_id, cost_credits")
          .eq("id", call_id)
          .single();

        if (call?.user_id) {
          const refund = call.cost_credits ?? 1;
          const { data: userData } = await supabase
            .from("users")
            .select("credits")
            .eq("id", call.user_id)
            .single();
          if (userData) {
            await supabase
              .from("users")
              .update({ credits: (userData.credits ?? 0) + refund })
              .eq("id", call.user_id);
          }
        }
      }
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
