import { Suspense } from "react";
import Link from "next/link";
import { Pencil, Phone, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Navbar } from "@/components/Navbar";
import { RefCapture } from "@/components/RefCapture";

const STEPS = [
  {
    icon: <Pencil className="size-6" />,
    title: "Brief",
    description: "Tell us what you need done. Any language, any task.",
  },
  {
    icon: <Phone className="size-6" />,
    title: "Call",
    description: "AI agent calls on your behalf and handles the conversation.",
  },
  {
    icon: <Check className="size-6" />,
    title: "Done",
    description: "Get a summary and full transcript of what happened.",
  },
];

const USE_CASES = [
  {
    title: "Restaurant Reservations",
    description:
      "Book a table at that place that only takes phone reservations. In any language.",
  },
  {
    title: "Appointments & Bookings",
    description:
      "Schedule a haircut, dentist visit, or mechanic appointment without the hold music.",
  },
  {
    title: "Quick Questions",
    description:
      "Check store hours, product availability, or pricing. Get answers without waiting.",
  },
  {
    title: "International Calls",
    description:
      "Need to call somewhere you don't speak the language? The AI agent handles it natively.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Suspense><RefCapture /></Suspense>
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-serif text-5xl sm:text-6xl font-normal tracking-[-0.02em] leading-tight">
            Hate making phone calls?
            <br />
            <em>We got you.</em>
          </h1>
          <p className="mt-8 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Any question. Any language. Just brief the agent and get it done.
          </p>
          <div className="mt-10">
            <Button asChild size="lg" className="rounded-full px-8 py-6 font-mono text-xs uppercase tracking-[0.1em]">
              <Link href="/call">
                Make a Call
                <ArrowRight />
              </Link>
            </Button>
          </div>
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            Invite friends to earn free credits.
          </p>
        </div>
      </section>

      {/* How it works */}
      <Separator />
      <section className="py-20 px-4">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-serif text-3xl font-semibold mb-14">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <h3 className="font-serif text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <Separator />
      <section className="py-20 px-4">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-serif text-3xl font-semibold mb-14">
            Perfect for...
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {USE_CASES.map((uc, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <h3 className="font-serif text-xl font-semibold mb-2">{uc.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {uc.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <Separator />
      <section className="py-20 px-4">
        <div className="mx-auto max-w-md text-center">
          <h2 className="font-serif text-3xl font-semibold mb-4">
            Ready to stop dialing?
          </h2>
          <p className="text-muted-foreground mb-8">
            Sign up in 10 seconds. Invite friends, earn free calls.
          </p>
          <Button asChild className="rounded-full px-8 font-mono text-xs uppercase tracking-[0.1em]">
            <Link href="/call">Get Started</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <Separator />
      <footer className="py-8 px-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between font-mono text-xs text-muted-foreground">
          <span>caall.ai</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
