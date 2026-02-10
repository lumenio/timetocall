"use client";

import { useUser } from "@/lib/hooks/useUser";

export function CreditBadge() {
  const { credits, loading } = useUser();

  if (loading) {
    return (
      <div className="h-7 w-20 animate-pulse rounded-full bg-surface" />
    );
  }

  if (credits === null) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm font-medium">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-warning"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12M6 12h12" />
      </svg>
      {credits} {credits === 1 ? "credit" : "credits"}
    </span>
  );
}
