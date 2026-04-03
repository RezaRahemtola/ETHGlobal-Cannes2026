import Link from "next/link";
import { Verifier } from "@/components/verifier";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center gap-6 px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">HumanENS</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Biometric-bound ENS identities using World ID. Prove you&apos;re human on-chain,
          protect your name, give your AI agents identity.
        </p>
        <div className="flex gap-3">
          <Link
            href="/link"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-all"
          >
            Get Started
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-5 text-sm font-medium transition-all hover:bg-muted"
          >
            Learn More
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="mb-8 text-center text-sm font-medium uppercase tracking-widest text-muted-foreground">
          How it works
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { step: 1, title: "Set ENS record", desc: "Connect your wallet and link your .eth name", context: "Browser", color: "text-blue-400" },
            { step: 2, title: "Verify with World ID", desc: "Prove you're a unique human with Orb verification", context: "World App", color: "text-purple-400" },
            { step: 3, title: "Get your .humanens.eth", desc: "Claim your verified subname and add AI agents", context: "World App", color: "text-green-400" },
          ].map(({ step, title, desc, context, color }) => (
            <div key={step} className="rounded-lg border bg-card p-4 text-center">
              <div className={`text-lg font-bold ${color}`}>{step}</div>
              <h3 className="mt-1 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              <span className="mt-2 inline-block text-xs text-muted-foreground/60">{context}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Verifier */}
      <section className="mx-auto max-w-md px-4 py-16">
        <h2 className="mb-6 text-center text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Verify a name
        </h2>
        <Verifier />
      </section>
    </main>
  );
}
