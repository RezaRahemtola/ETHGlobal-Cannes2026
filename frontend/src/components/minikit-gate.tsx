"use client";

import { MiniKit } from "@worldcoin/minikit-js";
import type { ReactNode } from "react";

export function MiniKitGate({ children }: { children: ReactNode }) {
  if (!MiniKit.isInstalled()) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="max-w-md text-center space-y-2">
          <h2 className="text-xl font-bold">Open in World App</h2>
          <p className="text-muted-foreground">
            This feature requires the World App. Open this link in World App to continue.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
