import { http, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const worldchain = {
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] },
  },
  blockExplorers: {
    default: {
      name: "World Chain Explorer",
      url: "https://worldchain-mainnet.explorer.alchemy.com",
    },
  },
} as const satisfies Parameters<typeof createConfig>[0]["chains"][number];

export const config = createConfig({
  chains: [mainnet, worldchain],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http("https://ethereum-rpc.publicnode.com"),
    [worldchain.id]: http(),
  },
});
