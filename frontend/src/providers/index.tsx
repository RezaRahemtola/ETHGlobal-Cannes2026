"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";
import { WagmiProvider } from "wagmi";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { config } from "@/lib/wagmi-config";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";

const ErudaProvider = dynamic(() => import("@/providers/Eruda").then((c) => c.ErudaProvider), {
  ssr: false,
});

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ErudaProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <MiniKitProvider>
            <NuqsAdapter>{children}</NuqsAdapter>
          </MiniKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErudaProvider>
  );
}
