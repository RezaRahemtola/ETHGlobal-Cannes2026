import Link from "next/link";
import { Verifier } from "@/components/verifier";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Iris halo background — subtle radial glow only */}
      <div
        className="pointer-events-none absolute left-1/2 top-8 h-[600px] w-[600px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(circle at center, rgba(110,231,183,0.06) 0%, rgba(56,137,255,0.04) 20%, rgba(139,92,246,0.02) 40%, transparent 65%)",
        }}
      />

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center gap-6 px-4 pt-16 pb-12 text-center">
        <h1 className="animate-fade-in-up max-w-lg text-4xl font-bold tracking-[-2px] sm:text-5xl leading-[1.08]">
          Seen by the Orb,
          <br />
          <span className="gradient-text">known by your name</span>
        </h1>
        <p className="animate-fade-in-up delay-100 max-w-md text-base text-muted-foreground leading-relaxed">
          World ID biometrics meet ENS naming. Prove you&apos;re human on-chain, protect
          your name, give your AI agents identity.
        </p>
        <div className="animate-fade-in-up delay-200 flex gap-3">
          <Link
            href="/link"
            className="btn-glow inline-flex h-11 items-center justify-center rounded-full px-8 text-sm font-medium shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
            style={{ backgroundColor: "#fafafa", color: "#09090b" }}
          >
            Get Started
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex h-11 items-center justify-center rounded-full px-8 text-sm text-muted-foreground transition-all hover:text-foreground hover:scale-[1.02]"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Learn More
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-2xl px-4 pt-8 pb-8">
        <h2 className="animate-fade-in mb-4 text-center text-[11px] font-medium uppercase tracking-[2px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          How it works
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Set ENS record",
              desc: "Connect wallet & link your .eth name",
              context: "Browser",
              color: "#6EE7B7",
              glowColor: "rgba(110,231,183,0.3)",
              delay: "delay-100",
            },
            {
              title: "Verify humanity",
              desc: "Prove you're unique with World ID Orb",
              context: "World App",
              color: "#3889FF",
              glowColor: "rgba(56,137,255,0.3)",
              delay: "delay-200",
            },
            {
              title: "Claim identity",
              desc: "Get your verified .humanens.eth subname",
              context: "World App",
              color: "#8B5CF6",
              glowColor: "rgba(139,92,246,0.3)",
              delay: "delay-300",
            },
          ].map(({ title, desc, context, color, glowColor, delay }) => (
            <div
              key={title}
              className={`animate-fade-in-up ${delay} glass-card glass-card-hover rounded-xl p-6 text-center`}
            >
              <div
                className="animate-subtle-pulse mx-auto mb-3 h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 12px ${glowColor}`,
                  ["--pulse-color" as string]: glowColor,
                }}
              />
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                {desc}
              </p>
              <span
                className="mt-3 inline-block text-[10px] uppercase tracking-[1px]"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {context}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Verifier */}
      <section className="mx-auto max-w-md px-4 pt-8 pb-16">
        <h2 className="animate-fade-in mb-4 text-center text-[11px] font-medium uppercase tracking-[2px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          Verify a name
        </h2>
        <div
          className="animate-fade-in-up delay-200 rounded-xl p-5"
          style={{
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <Verifier />
        </div>
      </section>
    </main>
  );
}
