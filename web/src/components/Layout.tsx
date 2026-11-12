import { Boxes, Building2, Globe2, Home, KeyRound, LockKeyhole, Menu, PackageCheck, ScanEye, ShieldCheck, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAccount, useSwitchChain } from "wagmi";
import { chains } from "../config";
import { useDeployment } from "../hooks/useCtx";
import { useKeys } from "../state/keys";
import { Ambient } from "./fx";
import { prefetchRoute } from "../routes";
import { Logo } from "./Logo";
import { Badge, Button } from "./ui";
import { ConnectButton } from "./Wallet";

const NAV = [
	{ to: "/", label: "Inicio", icon: Home, end: true },
	{ to: "/empresa", label: "Empresa pagadora", icon: Building2 },
	{ to: "/proveedor", label: "Proveedor", icon: PackageCheck },
	{ to: "/auditor", label: "Portal auditor", icon: ScanEye },
	{ to: "/publico", label: "Vista pública", icon: Globe2 },
	{ to: "/admin", label: "Administración", icon: ShieldCheck },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
	return (
		<nav className="space-y-1">
			{NAV.map(({ to, label, icon: Icon, end }) => (
				<NavLink
					key={to}
					to={to}
					end={end}
					onClick={onNavigate}
					onMouseEnter={() => prefetchRoute(to)}
					onFocus={() => prefetchRoute(to)}
					className={({ isActive }) =>
						`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
							isActive ? "bg-white/[0.07] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]" : "text-ink-300 hover:bg-white/[0.04] hover:text-white"
						}`
					}
				>
					{({ isActive }) => (
						<>
							<Icon className={`size-[18px] ${isActive ? "text-ava-400" : "text-ink-400 group-hover:text-ink-200"}`} />
							{label}
							{isActive && <span className="ml-auto size-1.5 rounded-full bg-ava-500 shadow-[0_0_10px_rgb(232_65_66)]" />}
						</>
					)}
				</NavLink>
			))}
		</nav>
	);
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
	const d = useDeployment();
	return (
		<div className="flex h-full flex-col">
			<div className="px-5 pt-6 pb-8">
				<Logo />
			</div>
			<div className="flex-1 px-3">
				<div className="px-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-400">Roles</div>
				<Nav onNavigate={onNavigate} />
			</div>
			<div className="m-3 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4">
				<div className="flex items-center gap-2 text-xs font-medium text-white">
					<LockKeyhole className="size-3.5 text-ava-400" /> eERC oficial · Ava Labs
				</div>
				<p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-400">
					Montos cifrados con ElGamal sobre BabyJubJub y pruebas Groth16. Sin forks de la criptografía.
				</p>
				{d && (
					<div className="mt-3 flex items-center gap-2">
						<Badge tone={d.chainId === 43113 ? "red" : "neutral"} dot>
							{d.chainId === 43113 ? "Avalanche Fuji" : d.network}
						</Badge>
					</div>
				)}
			</div>
		</div>
	);
}

function KeyChip() {
	const { isConnected } = useAccount();
	const { keyPair, unlock, lock, unlocking } = useKeys();
	if (!isConnected) return null;
	return keyPair ? (
		<button
			type="button"
			onClick={lock}
			title="Bloquear (olvidar la clave de esta sesión)"
			className="hidden items-center gap-2 rounded-xl border border-clear-500/25 bg-clear-500/10 px-3 py-2 text-xs font-medium text-clear-400 transition hover:bg-clear-500/15 sm:flex"
		>
			<KeyRound className="size-3.5" /> Clave eERC activa
		</button>
	) : (
		<span className="hidden sm:block">
			<Button variant="secondary" size="sm" className="h-[38px]" loading={unlocking} icon={<KeyRound className="size-3.5" />} onClick={() => unlock().catch(() => {})}>
				Desbloquear clave
			</Button>
		</span>
	);
}

function WrongNetwork() {
	const { isConnected } = useAccount();
	const d = useDeployment();
	const { switchChain } = useSwitchChain();
	if (!isConnected || d) return null;
	return (
		<div className="mx-auto mb-6 flex max-w-6xl items-center justify-between gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-3.5 text-sm text-amber-200">
			<span>La red de tu wallet no tiene un deployment de Trasluz.</span>
			<Button size="sm" onClick={() => switchChain({ chainId: chains[0].id })}>
				Cambiar a {chains[0].name}
			</Button>
		</div>
	);
}

export function Layout({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const loc = useLocation();
	const current = NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));
	return (
		<div className="min-h-screen lg:pl-72">
			<Ambient />
			<aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/[0.06] bg-ink-900 lg:block">
				<Sidebar />
			</aside>
			{open && (
				<div className="fixed inset-0 z-40 lg:hidden">
					<div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
					<aside className="absolute inset-y-0 left-0 w-72 border-r border-white/[0.06] bg-ink-900">
						<button type="button" className="absolute top-6 right-4 text-ink-400" onClick={() => setOpen(false)}>
							<X className="size-5" />
						</button>
						<Sidebar onNavigate={() => setOpen(false)} />
					</aside>
				</div>
			)}
			<header className="sticky top-0 z-20 border-b border-white/[0.06] bg-ink-950/85 backdrop-blur-md">
				<div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-8">
					<button type="button" className="text-ink-300 lg:hidden" onClick={() => setOpen(true)}>
						<Menu className="size-5" />
					</button>
					<div className="lg:hidden">
						<Logo compact />
					</div>
					<div className="hidden text-sm text-ink-400 lg:block">
						Trasluz <span className="mx-1.5 text-ink-600">/</span>
						<span className="text-white">{current?.label ?? ""}</span>
					</div>
					<div className="ml-auto flex items-center gap-2.5">
						<KeyChip />
						<ConnectButton />
					</div>
				</div>
			</header>
			<main className="px-4 py-8 md:px-8 md:py-10">
				<WrongNetwork />
				<div className="mx-auto max-w-6xl">{children}</div>
			</main>
			<footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-ink-400 md:px-8">
				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-6">
					<span>Trasluz · Riel de liquidación B2B confidencial — Track Avalanche, Argentina Space 2026</span>
					<span className="inline-flex items-center gap-1.5">
						<Boxes className="size-3.5" /> Compuesto sobre ava-labs/EncryptedERC
					</span>
				</div>
			</footer>
		</div>
	);
}
