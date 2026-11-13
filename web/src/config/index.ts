import type { Address, Chain } from "viem";
import { avalancheFuji, hardhat } from "viem/chains";
import { type CreateConnectorFn, createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import deploymentsJson from "./deployments.json";

export type Deployment = {
	network: string;
	chainId: number;
	deployBlock: number;
	deployedAt: string;
	explorer: string | null;
	owner: Address;
	auditor: Address;
	contracts: {
		registrar: Address;
		encryptedERC: Address;
		usdc: Address;
		settlementManager: Address;
		vaultImplementation: Address;
		[k: string]: Address;
	};
};

// deployments.json: redes públicas (versionado). deployments.local.json: hardhat local (gitignored, opcional).
const localDeployments = Object.values(import.meta.glob("./deployments.local.json", { eager: true, import: "default" }))[0] ?? {};
export const deployments = { ...(deploymentsJson as object), ...(localDeployments as object) } as Record<string, Deployment>;

const localChain: Chain = { ...hardhat, name: "Hardhat local", nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 } };
const ALL_CHAINS: Chain[] = [avalancheFuji, localChain];

/** Sólo las redes con deployment; Fuji primero (es la red de la demo). */
export const chains = (() => {
	const list = ALL_CHAINS.filter((c) => deployments[String(c.id)]);
	return (list.length ? list : [avalancheFuji]) as [Chain, ...Chain[]];
})();

export const getDeployment = (chainId?: number) => (chainId ? deployments[String(chainId)] : undefined);

// api.avax-test.network limita getLogs a 100 bloques por request; este RPC público admite los tramos de 2048 de lib/chain.ts.
const FUJI_RPC = "https://avalanche-fuji-c-chain-rpc.publicnode.com";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;

// Wallets instaladas: descubiertas por EIP-6963 (multiInjectedProviderDiscovery) + injected genérico.
// WalletConnect sólo si hay projectId. Su connector inicializa el SDK (~250 KB gzip + telemetría) en cuanto
// se registra, así que sólo se registra al inicio si hay una sesión WC que restaurar; si no, al elegirlo en el modal.
export const walletConnectConnector = projectId
	? walletConnect({ projectId, metadata: { name: "Trasluz", description: "Liquidación B2B confidencial", url: location.origin, icons: [`${location.origin}/favicon.svg`] }, showQrModal: true })
	: undefined;
const wcSession = !!walletConnectConnector && !!localStorage.getItem("wagmi.recentConnectorId")?.includes("walletConnect");
const connectors: CreateConnectorFn[] = [injected(), ...(wcSession && walletConnectConnector ? [walletConnectConnector] : [])];

export const wagmiConfig = createConfig({
	connectors,
	chains,
	multiInjectedProviderDiscovery: true,
	// JSON-RPC batch: las lecturas en paralelo viajan en un solo request HTTP.
	transports: Object.fromEntries(
		chains.map((c) => [c.id, http(c.id === avalancheFuji.id ? import.meta.env.VITE_FUJI_RPC_URL || FUJI_RPC : undefined, { batch: { wait: 16 } })]),
	),
	ssr: false,
});

export const USDC_DECIMALS = 6;
