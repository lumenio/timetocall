import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST() {
  const stripe = getStripe();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    metadata: {
      user_id: user.id,
      credits: "5",
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/credits?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/credits`,
  });

  return NextResponse.json({ url: session.url });
}
