import { createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { hederaTestnet } from "./hedera";

function rpc(url: string | undefined) {
  return url && url.length > 0 ? http(url) : http();
}

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, hederaTestnet],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: rpc(process.env.NEXT_PUBLIC_RPC_SEPOLIA),
    [hederaTestnet.id]: http("https://testnet.hashio.io/api"),
  },
  ssr: true,
});
