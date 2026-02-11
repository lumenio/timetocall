import Link from "next/link";
import { Pencil, Phone, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-lg font-bold tracking-tight">TimeToCall</span>
          <Button asChild size="sm">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight">
            Hate making
            <br />
            phone calls?
            <br />
            <span className="text-primary">We got you.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Any question. Any language. Just brief the agent, add a phone
            number, and get that long-awaited call done.
          </p>
          <div className="mt-10">
            <Button asChild size="lg" className="rounded-xl px-8 py-6 text-lg font-semibold">
              <Link href="/call">
                Make a Call
                <ArrowRight />
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            3 free calls to start. No credit card needed.
          </p>
        </div>
      </section>

      {/* How it works */}
      <Separator />
      <section className="py-20 px-4">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold mb-14">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
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
          <h2 className="text-center text-3xl font-bold mb-14">
            Perfect for...
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {USE_CASES.map((uc, i) => (
              <Card
                key={i}
                className="bg-card/50 transition-colors hover:bg-card"
              >
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">{uc.title}</h3>
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
          <h2 className="text-2xl font-bold mb-4">
            Ready to stop dialing?
          </h2>
          <p className="text-muted-foreground mb-8">
            Sign up in 10 seconds. Your first 3 calls are free.
          </p>
          <Button asChild className="rounded-xl px-8">
            <Link href="/call">Get Started</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <Separator />
      <footer className="py-8 px-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between text-sm text-muted-foreground">
          <span>TimeToCall</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
