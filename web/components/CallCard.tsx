"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Clock } from "lucide-react";

interface CallCardProps {
  id: string;
  phone_number: string;
  briefing: string;
  status: string;
  duration_seconds: number | null;
  summary: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  dialing: { label: "Dialing", variant: "default" },
  ringing: { label: "Ringing", variant: "default" },
  connected: { label: "Connected", variant: "outline" },
  completed: { label: "Completed", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function CallCard({
  id,
  phone_number,
  briefing,
  status,
  duration_seconds,
  summary,
  created_at,
}: CallCardProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <Link href={`/call/${id}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="flex items-start gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Phone className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-medium">{phone_number}</span>
              <Badge variant={config.variant}>{config.label}</Badge>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {summary || briefing}
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{formatRelativeTime(created_at)}</span>
              {duration_seconds != null && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {formatDuration(duration_seconds)}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
