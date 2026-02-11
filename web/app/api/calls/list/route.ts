import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: calls } = await supabase
    .from("calls")
    .select(
      "id, phone_number, briefing, status, duration_seconds, summary, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json(calls ?? []);
}
