"use client";

import { useAccount, useConnect, useDisconnect, useEnsName } from "wagmi";
import { injected } from "wagmi/connectors";
import { mainnet } from "wagmi/chains";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
  });

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span
          className="text-sm text-muted-foreground"
          style={ensName ? {} : { fontFamily: "monospace" }}
        >
          {ensName || `${address.slice(0, 6)}...${address.slice(-4)}`}
        </span>
        <button
          onClick={() => disconnect()}
          className="rounded-full px-4 py-2 text-xs text-muted-foreground transition-all hover:text-foreground hover:scale-[1.02]"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      disabled={isPending}
      className="rounded-full px-6 py-2.5 text-sm font-medium shadow-md transition-all hover:shadow-lg hover:scale-[1.03] disabled:opacity-50 disabled:hover:scale-100"
      style={{ backgroundColor: "#fafafa", color: "#09090b" }}
    >
      {isPending ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
