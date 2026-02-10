import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CallDetailClient } from "./CallDetailClient";

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify the call exists and belongs to this user
  const { data: call } = await supabase
    .from("calls")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!call) {
    redirect("/call");
  }

  return <CallDetailClient callId={id} />;
}
