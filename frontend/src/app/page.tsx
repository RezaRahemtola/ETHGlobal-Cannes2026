import Link from "next/link";
import { Verifier } from "@/components/verifier";
import { IrisLogo } from "@/components/iris-logo";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Iris halo background */}
      <div className="pointer-events-none absolute left-1/2 top-16 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(110,231,183,0.05)_0%,rgba(56,137,255,0.04)_25%,rgba(139,92,246,0.02)_45%,transparent_65%)]" />
      <div className="pointer-events-none absolute left-1/2 top-40 h-60 w-60 -translate-x-1/2 rounded-full border border-[var(--brand-mint)]/[0.04]" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-96 w-96 -translate-x-1/2 rounded-full border border-[var(--brand-blue)]/[0.03]" />

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center gap-6 px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-mint)]/10 bg-[var(--brand-mint)]/[0.06] px-4 py-1.5 text-xs text-[var(--brand-mint)]/70">
          <IrisLogo size={12} />
          Biometric Identity Protocol
        </div>
        <h1 className="max-w-lg text-4xl font-bold tracking-[-2px] sm:text-5xl leading-[1.08]">
          Seen by the Orb,
          <br />
          <span className="gradient-text">known by your name</span>
        </h1>
        <p className="max-w-md text-base text-muted-foreground leading-relaxed">
          World ID biometrics meet ENS naming. Prove you&apos;re human on-chain, protect
          your name, give your AI agents identity.
        </p>
        <div className="flex gap-3">
          <Link
            href="/link"
            className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Get Started
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--border-subtle)] px-8 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Learn More
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-2xl px-4 py-8">
        <h2 className="mb-5 text-center text-[11px] font-medium uppercase tracking-[2px] text-muted-foreground/60">
          How it works
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              title: "Set ENS record",
              desc: "Connect wallet & link your .eth name",
              context: "Browser",
              color: "bg-[var(--brand-mint)]",
              glow: "glow-mint",
            },
            {
              title: "Verify humanity",
              desc: "Prove you're unique with World ID Orb",
              context: "World App",
              color: "bg-[var(--brand-blue)]",
              glow: "glow-blue",
            },
            {
              title: "Claim identity",
              desc: "Get your verified .humanens.eth subname",
              context: "World App",
              color: "bg-[var(--brand-purple)]",
              glow: "glow-purple",
            },
          ].map(({ title, desc, context, color, glow }) => (
            <div
              key={title}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center"
            >
              <div
                className={`mx-auto mb-3 h-2.5 w-2.5 rounded-full ${color} ${glow}`}
              />
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {desc}
              </p>
              <span className="mt-2 inline-block text-[10px] uppercase tracking-[1px] text-muted-foreground/50">
                {context}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Verifier */}
      <section className="mx-auto max-w-md px-4 py-8 pb-16">
        <h2 className="mb-4 text-center text-[11px] font-medium uppercase tracking-[2px] text-muted-foreground/60">
          Verify a name
        </h2>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <Verifier />
        </div>
      </section>
    </main>
  );
}
