import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function generateReferralCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/call";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Create service role client for admin operations
        const adminSupabase = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Check if user already exists (returning user vs new signup)
        const { data: existingUser } = await adminSupabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .single();

        if (!existingUser) {
          // New user — handle referral logic and create row
          const referralCode = generateReferralCode();

          const cookieStore = await cookies();
          const refCookie = cookieStore.get("ref")?.value;
          const refCode = refCookie ? decodeURIComponent(refCookie) : null;

          let referrerId: string | null = null;
          if (refCode) {
            const { data: referrer } = await adminSupabase
              .from("users")
              .select("id")
              .eq("referral_code", refCode)
              .single();
            if (referrer && referrer.id !== user.id) {
              // Check referrer hasn't hit the 10-referral cap
              const { count } = await adminSupabase
                .from("users")
                .select("id", { count: "exact", head: true })
                .eq("referred_by", referrer.id);
              if ((count ?? 0) < 10) {
                referrerId = referrer.id;
              }
            }
          }

          // Create the new user row
          await adminSupabase.from("users").insert({
            id: user.id,
            email: user.email,
            credits: 0,
            referral_code: referralCode,
            ...(referrerId ? { referred_by: referrerId } : {}),
          });

          // Grant referrer +1 credit
          if (referrerId) {
            const { data: referrerData } = await adminSupabase
              .from("users")
              .select("credits")
              .eq("id", referrerId)
              .single();
            if (referrerData) {
              await adminSupabase
                .from("users")
                .update({ credits: (referrerData.credits ?? 0) + 1 })
                .eq("id", referrerId);
            }
          }
        }

        // Clear the ref cookie
        const response = NextResponse.redirect(`${origin}${next}`);
        response.cookies.set("ref", "", { path: "/", maxAge: 0 });
        return response;
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
