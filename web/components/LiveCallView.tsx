"use client";

import { useEffect, useState, useRef } from "react";

interface TranscriptEntry {
  speaker: "agent" | "callee";
  text: string;
  timestamp: string;
}

interface CallData {
  id: string;
  status: string;
  duration_seconds: number | null;
  transcript: TranscriptEntry[] | null;
  summary: string | null;
  created_at: string;
  completed_at: string | null;
  briefing: string;
  phone_number: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; pulse?: boolean }
> = {
  pending: { label: "Pending", color: "bg-zinc-500" },
  dialing: { label: "Dialing", color: "bg-primary", pulse: true },
  ringing: { label: "Ringing", color: "bg-primary", pulse: true },
  connected: { label: "Connected", color: "bg-warning", pulse: true },
  completed: { label: "Completed", color: "bg-success" },
  failed: { label: "Failed", color: "bg-danger" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium">
      <span className="relative flex h-2.5 w-2.5">
        {config.pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.color} opacity-75`}
          />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${config.color}`}
        />
      </span>
      {config.label}
    </span>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LiveCallView({ callId }: { callId: string }) {
  const [call, setCall] = useState<CallData | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const isTerminal = call?.status === "completed" || call?.status === "failed";
  const isActive =
    call?.status === "connected" ||
    call?.status === "dialing" ||
    call?.status === "ringing";

  // Poll for call status
  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/calls/${callId}`);
        if (!res.ok) throw new Error("Failed to fetch call status");
        const data = await res.json();
        if (active) setCall(data);
      } catch {
        if (active) setError("Failed to load call status");
      }
    };

    poll();
    const interval = setInterval(() => {
      if (!isTerminal) poll();
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [callId, isTerminal]);

  // Duration timer
  useEffect(() => {
    if (call?.status !== "connected") return;

    const start = new Date(call.created_at).getTime();
    const tick = () => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [call?.status, call?.created_at]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [call?.transcript?.length]);

  const handleEndCall = async () => {
    setEnding(true);
    try {
      await fetch(`/api/calls/${callId}/end`, { method: "POST" });
    } catch {
      setEnding(false);
    }
  };

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/10 p-6 text-center">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-surface" />
        <div className="h-64 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <StatusBadge status={call.status} />
        {(call.status === "connected" || call.duration_seconds) && (
          <span className="font-mono text-sm text-muted">
            {formatDuration(call.duration_seconds ?? elapsed)}
          </span>
        )}
      </div>

      {/* Transcript */}
      <div className="rounded-lg border border-border bg-surface/50 p-4">
        <h3 className="text-sm font-medium text-muted mb-3">Transcript</h3>
        <div className="max-h-80 overflow-y-auto space-y-3">
          {(!call.transcript || call.transcript.length === 0) && (
            <p className="text-sm text-muted italic">
              {isActive
                ? "Waiting for conversation to start..."
                : call.status === "failed"
                  ? "No transcript available"
                  : "No transcript yet"}
            </p>
          )}
          {call.transcript?.map((entry, i) => (
            <div
              key={i}
              className={`text-sm ${
                entry.speaker === "agent" ? "text-primary" : "text-foreground"
              }`}
            >
              <span className="font-medium">
                {entry.speaker === "agent" ? "AI Agent" : "Callee"}:
              </span>{" "}
              {entry.text}
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* Summary */}
      {call.status === "completed" && call.summary && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <h3 className="text-sm font-medium text-success mb-2">
            Call Summary
          </h3>
          <p className="text-sm text-foreground leading-relaxed">
            {call.summary}
          </p>
        </div>
      )}

      {/* Failed state */}
      {call.status === "failed" && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-center">
          <p className="text-sm text-danger">
            This call could not be completed.
          </p>
        </div>
      )}

      {/* End Call button */}
      {isActive && (
        <button
          onClick={handleEndCall}
          disabled={ending}
          className="w-full rounded-lg border border-danger bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
        >
          {ending ? "Ending call..." : "End Call"}
        </button>
      )}

      {/* Back to new call */}
      {isTerminal && (
        <a
          href="/call"
          className="block w-full rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-surface"
        >
          Make Another Call
        </a>
      )}
    </div>
  );
}
