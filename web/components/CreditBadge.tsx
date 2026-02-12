"use client";

import Link from "next/link";
import { CircleDot, Plus } from "lucide-react";
import { useUser } from "@/lib/hooks/useUser";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function CreditBadge() {
  const { credits, loading } = useUser();

  if (loading) {
    return <Skeleton className="h-7 w-20 rounded-full" />;
  }

  if (credits === null) return null;

  return (
    <Link href="/credits" className="flex items-center gap-1">
      <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sm">
        <CircleDot className="size-3.5" />
        {credits} {credits === 1 ? "credit" : "credits"}
      </Badge>
      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
        <Plus className="size-3.5" />
      </span>
    </Link>
  );
}
