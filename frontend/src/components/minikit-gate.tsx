"use client";

import { IrisLogo } from "@/components/iris-logo";
import { WORLD_APP_ID } from "@/lib/constants";
import { useMiniKit } from "@worldcoin/minikit-js/minikit-provider";
import { usePathname } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import type { ReactNode } from "react";

function MiniKitGateScreen({ description }: { description?: string }) {
  const pathname = usePathname();
  const encodedPath = encodeURIComponent(pathname);
  const universalLink = `https://world.org/mini-app?app_id=${WORLD_APP_ID}&path=${encodedPath}`;
  const deepLink = `worldapp://mini-app?app_id=${WORLD_APP_ID}&path=${encodedPath}`;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 pb-12 text-center">
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
        {description ??
          "Scan this QR code with World App to verify your identity and register your subname."}
      </p>

      {WORLD_APP_ID ? (
        <div
          className="animate-fade-in-up delay-200 relative mt-8 rounded-2xl bg-white p-3"
          style={{
            boxShadow:
              "0 0 40px rgba(110,231,183,0.1), 0 0 80px rgba(56,137,255,0.06), 0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          <QRCodeSVG value={universalLink} size={180} level="M" />
        </div>
      ) : (
        <p className="animate-fade-in-up delay-200 mt-8 text-sm text-destructive">
          App configuration missing. Please set NEXT_PUBLIC_WORLD_APP_ID.
        </p>
      )}

      {/* "Open in World App" — mobile only */}
      {WORLD_APP_ID && (
        <a
          href={deepLink}
          className="mobile-only-btn animate-fade-in-up delay-300 mt-6 items-center rounded-full px-6 py-2.5 text-sm font-medium shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
          style={{ backgroundColor: "#fafafa", color: "#09090b" }}
        >
          Open in World App
        </a>
      )}

      <p
        className="animate-fade-in delay-400 mt-6 text-xs"
        style={{ color: "rgba(255,255,255,0.3)" }}
      >
        or search{" "}
        <span className="font-medium" style={{ color: "rgba(110,231,183,0.6)" }}>
          &quot;HumanENS&quot;
        </span>{" "}
        in World App
      </p>
    </div>
  );
}

export function MiniKitGate({
  children,
  description,
}: {
  children: ReactNode;
  description?: string;
}) {
  const { isInstalled } = useMiniKit();

  if (!isInstalled) {
    return <MiniKitGateScreen description={description} />;
  }

  return <>{children}</>;
}
