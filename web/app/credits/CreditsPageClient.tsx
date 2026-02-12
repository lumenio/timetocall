"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Check, CreditCard, Users, Loader2, CircleCheck } from "lucide-react";

export function CreditsPageClient({
  credits,
  referralCode,
}: {
  credits: number;
  referralCode: string | null;
}) {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "1";
  const [copied, setCopied] = useState(false);
  const [buying, setBuying] = useState(false);

  const referralUrl = referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${referralCode}`
    : "";

  const handleBuy = async () => {
    setBuying(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setBuying(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-lg px-4 pt-24 pb-16">
        <h1 className="font-serif text-2xl font-semibold mb-1">Credits</h1>
        <p className="text-sm text-muted-foreground mb-8">
          You have{" "}
          <span className="font-medium text-foreground">
            {credits} {credits === 1 ? "credit" : "credits"}
          </span>
        </p>

        {success && (
          <Alert className="mb-6">
            <CircleCheck className="size-4" />
            <AlertDescription>
              Payment successful! Your credits have been added.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* Buy credits */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CreditCard className="size-5" />
                </div>
                <div className="flex-1">
                  <h2 className="font-serif text-lg font-semibold">Buy credits</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    5 credits for $9.99. One credit per call.
                  </p>
                  <Button className="mt-4" onClick={handleBuy} disabled={buying}>
                    {buying ? (
                      <>
                        <Loader2 className="animate-spin size-4 mr-1" />
                        Redirecting...
                      </>
                    ) : (
                      "Buy 5 Credits \u2014 $9.99"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
            <Separator className="flex-1" />
          </div>

          {/* Invite a friend */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-serif text-lg font-semibold">Invite a friend</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get 1 free credit for every friend who signs up.
                  </p>
                  {referralCode && (
                    <div className="mt-4 flex items-center gap-2">
                      <code className="flex-1 truncate rounded border bg-muted px-3 py-2 text-xs">
                        {referralUrl}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="shrink-0"
                      >
                        {copied ? (
                          <>
                            <Check className="size-3.5 mr-1" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5 mr-1" /> Copy
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
