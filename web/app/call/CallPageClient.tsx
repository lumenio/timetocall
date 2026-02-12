"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { CallForm } from "@/components/CallForm";
import { AlertCircle } from "lucide-react";

export function CallPageClient({ credits, referralCode }: { credits: number; referralCode: string | null }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (data: {
    briefing: string;
    phoneNumber: string;
    language: string;
  }) => {
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const { callId } = await res.json();
      router.push(`/call/${callId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-lg px-4 pt-24 pb-16">
        <h1 className="font-serif text-2xl font-semibold mb-1">New Call</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Brief the AI agent and provide a phone number.
        </p>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <AlertCircle className="size-4 shrink-0 translate-y-0.5 text-destructive" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
        )}

        <CallForm
          credits={credits}
          referralCode={referralCode}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </main>
    </>
  );
}
