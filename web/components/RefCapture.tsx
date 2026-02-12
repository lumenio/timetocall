"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function RefCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      document.cookie = `ref=${encodeURIComponent(ref)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    }
  }, [searchParams]);

  return null;
}
