"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { CallCard } from "@/components/CallCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Phone } from "lucide-react";

interface CallListItem {
  id: string;
  phone_number: string;
  briefing: string;
  status: string;
  duration_seconds: number | null;
  summary: string | null;
  created_at: string;
}

export function HistoryPageClient() {
  const [calls, setCalls] = useState<CallListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchCalls() {
      try {
        const res = await fetch("/api/calls/list");
        if (!res.ok) throw new Error("Failed to fetch calls");
        const data = await res.json();
        setCalls(data);
      } catch {
        setError("Failed to load call history");
      } finally {
        setLoading(false);
      }
    }
    fetchCalls();
  }, []);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pt-24 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl font-semibold">Call History</h1>
          <Button asChild size="sm">
            <Link href="/call">New Call</Link>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!loading && !error && calls.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Phone className="size-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">No calls yet</p>
              <p className="text-sm text-muted-foreground">
                Make your first call and it will appear here.
              </p>
            </div>
            <Button asChild>
              <Link href="/call">Make a Call</Link>
            </Button>
          </div>
        )}

        {!loading && calls.length > 0 && (
          <div className="flex flex-col gap-4">
            {calls.map((call) => (
              <CallCard key={call.id} {...call} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
