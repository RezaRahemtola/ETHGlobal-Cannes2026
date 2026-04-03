"use client";

import { MiniKit } from "@worldcoin/minikit-js";
import { usePathname } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import type { ReactNode } from "react";
import { IrisLogo } from "@/components/iris-logo";
import { WORLD_APP_ID } from "@/lib/constants";

function MiniKitGateScreen() {
  const pathname = usePathname();
  const encodedPath = encodeURIComponent(pathname);
  const universalLink = `https://world.org/mini-app?app_id=${WORLD_APP_ID}&path=${encodedPath}`;
  const deepLink = `worldapp://mini-app?app_id=${WORLD_APP_ID}&path=${encodedPath}`;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 text-center">
      {/* Iris halo behind QR */}
      <div
        className="pointer-events-none absolute h-[400px] w-[400px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(110,231,183,0.06) 0%, rgba(56,137,255,0.04) 25%, rgba(139,92,246,0.02) 45%, transparent 65%)",
        }}
      />

      <IrisLogo size={48} className="mb-6 animate-fade-in" />
      <h2 className="animate-fade-in-up text-xl font-bold tracking-tight">Continue in World App</h2>
      <p className="animate-fade-in-up delay-100 mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
        Scan this QR code with World App to verify your identity and register your subname.
      </p>

      <div
        className="animate-fade-in-up delay-200 relative mt-7 rounded-2xl bg-white p-3"
        style={{
          boxShadow: "0 0 40px rgba(110,231,183,0.1), 0 0 80px rgba(56,137,255,0.06), 0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <QRCodeSVG
          value={universalLink}
          size={180}
          level="M"
          imageSettings={{
            src: "",
            height: 0,
            width: 0,
            excavate: false,
          }}
        />
      </div>

      {/* "Open in World App" — visible on small screens only */}
      <a
        href={deepLink}
        className="animate-fade-in-up delay-300 mt-5 inline-flex items-center rounded-full px-6 py-2.5 text-sm font-medium shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl sm:hidden"
        style={{ backgroundColor: "#fafafa", color: "#09090b" }}
      >
        Open in World App
      </a>

      <p className="animate-fade-in delay-400 mt-4 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
        or search{" "}
        <span className="font-medium" style={{ color: "rgba(110,231,183,0.6)" }}>&quot;HumanENS&quot;</span>{" "}
        in World App
      </p>
    </div>
  );
}

export function MiniKitGate({ children }: { children: ReactNode }) {
  if (!MiniKit.isInstalled()) {
    return <MiniKitGateScreen />;
  }

  return <>{children}</>;
}
