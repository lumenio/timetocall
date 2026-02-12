import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const adminSupabase = getAdminSupabase();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  // If webhook secret is configured, verify signature
  let event: Stripe.Event;
  if (process.env.STRIPE_WEBHOOK_SECRET && signature) {
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    event = JSON.parse(body) as Stripe.Event;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const credits = parseInt(session.metadata?.credits ?? "0", 10);

    if (userId && credits > 0) {
      const { data: userData } = await adminSupabase
        .from("users")
        .select("credits")
        .eq("id", userId)
        .single();

      if (userData) {
        await adminSupabase
          .from("users")
          .update({ credits: (userData.credits ?? 0) + credits })
          .eq("id", userId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
