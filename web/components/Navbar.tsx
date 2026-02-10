"use client";

import Link from "next/link";
import { useUser } from "@/lib/hooks/useUser";
import { CreditBadge } from "./CreditBadge";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function Navbar() {
  const { user, loading } = useUser();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          TimeToCall
        </Link>

        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-8 w-24 animate-pulse rounded-lg bg-surface" />
          ) : user ? (
            <>
              <CreditBadge />
              <button
                onClick={handleSignOut}
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
