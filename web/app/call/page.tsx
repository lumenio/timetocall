import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CallPageClient } from "./CallPageClient";

export default async function CallPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("users")
    .select("credits")
    .eq("id", user.id)
    .single();

  return <CallPageClient credits={data?.credits ?? 0} />;
}
