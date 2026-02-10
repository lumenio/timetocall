import Link from "next/link";

const STEPS = [
  {
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20h9" />
        <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
      </svg>
    ),
    title: "Brief",
    description: "Tell us what you need done. Any language, any task.",
  },
  {
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
    title: "Call",
    description: "AI agent calls on your behalf and handles the conversation.",
  },
  {
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
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
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-lg font-bold tracking-tight">TimeToCall</span>
          <Link
            href="/login"
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Sign In
          </Link>
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
          <p className="mt-6 text-lg sm:text-xl text-muted max-w-xl mx-auto leading-relaxed">
            Any question. Any language. Just brief the agent, add a phone
            number, and get that long-awaited call done.
          </p>
          <div className="mt-10">
            <Link
              href="/call"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-lg font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              Make a Call
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">
            3 free calls to start. No credit card needed.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 border-t border-border">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold mb-14">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-20 px-4 border-t border-border">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold mb-14">
            Perfect for...
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {USE_CASES.map((uc, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-surface/50 p-6 transition-colors hover:bg-surface"
              >
                <h3 className="font-semibold mb-2">{uc.title}</h3>
                <p className="text-sm text-muted leading-relaxed">
                  {uc.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-border">
        <div className="mx-auto max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">
            Ready to stop dialing?
          </h2>
          <p className="text-muted mb-8">
            Sign up in 10 seconds. Your first 3 calls are free.
          </p>
          <Link
            href="/call"
            className="inline-flex rounded-xl bg-primary px-8 py-3 font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between text-sm text-muted">
          <span>TimeToCall</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
