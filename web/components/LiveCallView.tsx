"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

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
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; pulse?: boolean }
> = {
  pending: { label: "Pending", variant: "secondary" },
  dialing: { label: "Dialing", variant: "default", pulse: true },
  ringing: { label: "Ringing", variant: "default", pulse: true },
  connected: { label: "Connected", variant: "outline", pulse: true },
  completed: { label: "Completed", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <Badge variant={config.variant} className="gap-1.5">
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
      </span>
      {config.label}
    </Badge>
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
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!call) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <StatusBadge status={call.status} />
        {(call.status === "connected" || call.duration_seconds) && (
          <span className="font-mono text-sm text-muted-foreground">
            {formatDuration(call.duration_seconds ?? elapsed)}
          </span>
        )}
      </div>

      {/* Call context */}
      <div className="space-y-1">
        <p className="font-mono text-sm font-medium">{call.phone_number}</p>
        <p className="text-sm text-muted-foreground">{call.briefing}</p>
      </div>

      {/* Summary */}
      {call.status === "completed" && call.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4" />
              Call Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{call.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-y-auto space-y-3">
            {(!call.transcript || call.transcript.length === 0) && (
              <p className="text-sm text-muted-foreground italic">
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
        </CardContent>
      </Card>

      {/* Failed state */}
      {call.status === "failed" && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>This call could not be completed.</AlertDescription>
        </Alert>
      )}

      {/* End Call button */}
      {isActive && (
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleEndCall}
          disabled={ending}
        >
          {ending ? "Ending call..." : "End Call"}
        </Button>
      )}

      {/* Navigation */}
      {isTerminal && (
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" asChild>
            <Link href="/history">Call History</Link>
          </Button>
          <Button variant="outline" className="flex-1" asChild>
            <Link href="/call">New Call</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
