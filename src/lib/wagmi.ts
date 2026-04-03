import { createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";

function rpc(url: string | undefined) {
  return url && url.length > 0 ? http(url) : http();
}

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http("https://eth.llamarpc.com"),
    [sepolia.id]: rpc(process.env.NEXT_PUBLIC_RPC_SEPOLIA),
  },
  ssr: true,
});
