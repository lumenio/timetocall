"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data } = await supabase
          .from("users")
          .select("credits, referral_code")
          .eq("id", user.id)
          .single();
        setCredits(data?.credits ?? 0);
        setReferralCode(data?.referral_code ?? null);
      }

      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setCredits(null);
        setReferralCode(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshCredits = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("users")
      .select("credits")
      .eq("id", user.id)
      .single();
    setCredits(data?.credits ?? 0);
  };

  return { user, credits, referralCode, loading, refreshCredits };
}
