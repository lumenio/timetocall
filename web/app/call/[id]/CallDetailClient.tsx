"use client";

import { Navbar } from "@/components/Navbar";
import { LiveCallView } from "@/components/LiveCallView";

export function CallDetailClient({ callId }: { callId: string }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-lg px-4 pt-24 pb-16">
        <h1 className="font-serif text-2xl font-semibold mb-6">Call Status</h1>
        <LiveCallView callId={callId} />
      </main>
    </>
  );
}
