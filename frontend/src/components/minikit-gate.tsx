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
      <IrisLogo size={48} className="mb-6" />
      <h2 className="text-xl font-bold tracking-tight">Continue in World App</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
        Scan this QR code with World App to verify your identity and register your subname.
      </p>

      <div className="mt-7 rounded-2xl bg-white p-3">
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

      <a
        href={deepLink}
        className="mt-5 inline-flex items-center rounded-full border border-[var(--border-subtle)] px-5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:hidden"
      >
        Open in World App
      </a>

      <p className="mt-4 text-xs text-muted-foreground/50">
        or search{" "}
        <span className="font-medium text-[var(--brand-mint)]/60">&quot;HumanENS&quot;</span>{" "}
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
