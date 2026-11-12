import { Check, ChevronDown, Copy, ExternalLink, LogOut, Wallet as WalletIcon, X } from "lucide-react";
import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { type Connector, useAccount, useBalance, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { chains, getDeployment, walletConnectConnector } from "../config";
import { short } from "../lib/format";
import { Button } from "./ui";

/**
 * Conexión de wallet propia sobre wagmi (reemplaza RainbowKit: ~500 KB menos).
 * Las wallets instaladas se descubren por EIP-6963 (Core, MetaMask, Rabby…).
 */
type ModalApi = { open: () => void };
const Ctx = createContext<ModalApi>({ open: () => {} });
export const useWalletModal = () => useContext(Ctx);

const Avatar = ({ a, size = 18 }: { a: string; size?: number }) => {
	const hue = Number.parseInt(a.slice(2, 8), 16) % 360;
	return (
		<span
			className="inline-block shrink-0 rounded-full ring-1 ring-white/20"
			style={{ width: size, height: size, background: `conic-gradient(from ${hue}deg, hsl(${hue} 70% 55%), hsl(${(hue + 120) % 360} 70% 45%), hsl(${hue} 70% 55%))` }}
		/>
	);
};

function WalletModal({ onClose }: { onClose: () => void }) {
	const { connectors, connect, isPending, variables, error } = useConnect();
	const { isConnected } = useAccount();
	useEffect(() => {
		if (isConnected) onClose();
	}, [isConnected, onClose]);
	useEffect(() => {
		const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", esc);
		return () => window.removeEventListener("keydown", esc);
	}, [onClose]);

	// EIP-6963 primero; el "injected" genérico sólo si no se descubrió ninguna wallet.
	const discovered = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
	const list: Connector[] = [...(discovered.length ? discovered : connectors.filter((c) => c.id === "injected")), ...connectors.filter((c) => c.type === "walletConnect")];
	const lazyWc = walletConnectConnector && !list.some((c) => c.type === "walletConnect") ? walletConnectConnector : undefined;
	const pendingId = typeof variables?.connector === "function" ? "wc" : variables?.connector?.uid;
	const hasInjected = list.some((c) => c.type === "injected") && "ethereum" in window;
	const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

	return (
		<div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4 backdrop-blur-sm animate-fade-up" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<div role="dialog" aria-modal="true" aria-label="Conectar wallet" className="card w-full max-w-sm overflow-hidden">
				<div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
					<div className="text-[15px] font-semibold text-white">Conectar wallet</div>
					<button type="button" onClick={onClose} className="text-ink-400 hover:text-white" aria-label="Cerrar">
						<X className="size-5" />
					</button>
				</div>
				<div className="space-y-2 p-4">
					{list.map((c) => (
						<button
							key={c.uid}
							type="button"
							disabled={isPending}
							onClick={() => connect({ connector: c, chainId: chains[0].id })}
							className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-left text-sm font-medium text-white transition hover:border-ava-500/40 hover:bg-white/[0.06] disabled:opacity-60"
						>
							{c.icon ? <img src={c.icon} alt="" className="size-7 rounded-lg" /> : <span className="grid size-7 place-items-center rounded-lg bg-white/[0.06]"><WalletIcon className="size-4" /></span>}
							<span className="flex-1">{c.id === "injected" ? "Wallet del navegador" : c.type === "walletConnect" ? "WalletConnect (QR)" : c.name}</span>
							{isPending && pendingId === c.uid ? (
								<span className="text-xs text-ink-400">Esperando…</span>
							) : c.type === "injected" ? (
								<span className="text-[11px] text-clear-400">instalada</span>
							) : (
								<span className="text-[11px] text-ink-400">celular</span>
							)}
						</button>
					))}
					{lazyWc && (
						<button
							type="button"
							disabled={isPending}
							onClick={() => connect({ connector: lazyWc, chainId: chains[0].id })}
							className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-left text-sm font-medium text-white transition hover:border-ava-500/40 hover:bg-white/[0.06] disabled:opacity-60"
						>
							<span className="grid size-7 place-items-center rounded-lg bg-white/[0.06]">
								<WalletIcon className="size-4" />
							</span>
							<span className="flex-1">WalletConnect (QR)</span>
							<span className="text-[11px] text-ink-400">{isPending && pendingId === "wc" ? "Cargando…" : "celular"}</span>
						</button>
					)}
					{mobile && !hasInjected && (
						<a
							href={`https://metamask.app.link/dapp/${location.host}${location.pathname}`}
							className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition hover:border-ava-500/40 hover:bg-white/[0.06]"
						>
							<span className="grid size-7 place-items-center rounded-lg bg-white/[0.06]">
								<ExternalLink className="size-4" />
							</span>
							<span className="flex-1">Abrir en la app de MetaMask</span>
						</a>
					)}
					{list.length === 0 && !mobile && (
						<div className="rounded-xl border border-white/[0.07] p-4 text-sm text-ink-300">
							No detectamos ninguna wallet.{" "}
							<a className="text-ava-300 underline" href="https://core.app/" target="_blank" rel="noreferrer">
								Instalá Core
							</a>
							, la wallet de Avalanche.
						</div>
					)}
					{error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">{error.message.split("\n")[0]}</div>}
				</div>
				<div className="border-t border-white/[0.06] px-5 py-3 text-[11.5px] text-ink-400">
					Conectar no firma nada ni da acceso a tus fondos. Se necesita una cuenta EOA: las smart wallets (Safe, Coinbase Smart Wallet, MPC) no son compatibles con la clave de cifrado.
				</div>
			</div>
		</div>
	);
}

function AccountMenu() {
	const { address, connector } = useAccount();
	const chainId = useChainId();
	const d = getDeployment(chainId);
	const { data: bal } = useBalance({ address, query: { refetchInterval: 15_000 } });
	const { disconnect } = useDisconnect();
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!open) return;
		const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
		window.addEventListener("mousedown", off);
		return () => window.removeEventListener("mousedown", off);
	}, [open]);
	if (!address) return null;
	const avax = bal ? Number(formatUnits(bal.value, bal.decimals)) : null;
	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="flex h-[38px] items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.05] pr-2.5 pl-3 text-sm font-medium text-white transition hover:bg-white/[0.09]"
			>
				{avax !== null && <span className="hidden text-ink-300 md:inline">{avax >= 1000 ? `${(avax / 1000).toFixed(1)}k` : avax.toFixed(2)} AVAX</span>}
				<Avatar a={address} />
				<span className="font-mono text-[13px]">{short(address)}</span>
				<ChevronDown className={`size-4 text-ink-400 transition ${open ? "rotate-180" : ""}`} />
			</button>
			{open && (
				<div className="card absolute right-0 z-40 mt-2 w-64 overflow-hidden animate-fade-up">
					<div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
						<Avatar a={address} size={28} />
						<div className="min-w-0">
							<div className="truncate font-mono text-[13px] text-white">{short(address, 6)}</div>
							<div className="text-[11px] text-ink-400">
								{connector?.name} · {d?.chainId === 43113 ? "Avalanche Fuji" : (d?.network ?? "red no soportada")}
							</div>
						</div>
					</div>
					<div className="p-1.5 text-sm">
						<button
							type="button"
							className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-ink-200 hover:bg-white/[0.06]"
							onClick={() => {
								navigator.clipboard.writeText(address);
								setCopied(true);
								setTimeout(() => setCopied(false), 1200);
							}}
						>
							{copied ? <Check className="size-4 text-clear-400" /> : <Copy className="size-4" />} Copiar dirección
						</button>
						{d?.explorer && (
							<a className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-ink-200 hover:bg-white/[0.06]" href={`${d.explorer}/address/${address}`} target="_blank" rel="noreferrer">
								<ExternalLink className="size-4" /> Ver en Snowtrace
							</a>
						)}
						<button type="button" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-red-300 hover:bg-red-500/10" onClick={() => disconnect()}>
							<LogOut className="size-4" /> Desconectar
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

/** Botón del header: conectar / cambiar de red / cuenta. */
export function ConnectButton() {
	const { isConnected } = useAccount();
	const chainId = useChainId();
	const { switchChain, isPending } = useSwitchChain();
	const { open } = useWalletModal();
	if (!isConnected) return <Button onClick={open}>Conectar wallet</Button>;
	if (!getDeployment(chainId)) {
		return (
			<Button variant="danger" loading={isPending} onClick={() => switchChain({ chainId: chains[0].id })}>
				Red incorrecta
			</Button>
		);
	}
	return <AccountMenu />;
}

export function WalletProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const close = useRef(() => setOpen(false)).current;
	return (
		<Ctx.Provider value={{ open: () => setOpen(true) }}>
			{children}
			{open && <WalletModal onClose={close} />}
		</Ctx.Provider>
	);
}
