import { Check, Fingerprint, KeyRound, ShieldAlert, UserCheck, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useCtx, useEntity } from "../hooks/useCtx";
import { register } from "../lib/eerc";
import { useAction } from "../state/action";
import { useKeys } from "../state/keys";
import { Addr, Button, Card, Skeleton } from "./ui";
import { useWalletModal } from "./Wallet";

type Item = { done: boolean; title: string; desc: ReactNode; icon: ReactNode; action?: ReactNode };

/**
 * Onboarding por pasos: wallet → KYC (allowlist) → clave eERC registrada → clave desbloqueada.
 * Renderiza `children` sólo cuando todo está listo.
 */
export function Gate({ children, role, requireKyc = true }: { children: ReactNode; role: string; requireKyc?: boolean }) {
	const { ctx, d, address, isConnected } = useCtx();
	const { open: openConnectModal } = useWalletModal();
	const ent = useEntity(address);
	const { keyPair, unlock, unlocking, error: keyError } = useKeys();
	const { run } = useAction();

	if (!isConnected) {
		return (
			<Card className="grid-bg overflow-hidden p-10 text-center">
				<div className="mx-auto grid size-14 place-items-center rounded-2xl bg-ava-500/10 text-ava-400 ring-1 ring-ava-500/20">
					<Wallet className="size-6" />
				</div>
				<h3 className="mt-5 text-lg font-semibold text-white">Conectá la wallet de {role}</h3>
				<p className="mx-auto mt-1.5 max-w-md text-sm text-ink-400">Core, MetaMask o Rabby sobre Avalanche Fuji.</p>
				<Button className="mt-6" onClick={openConnectModal}>
					Conectar wallet
				</Button>
			</Card>
		);
	}
	if (!d || !ctx) return null;
	if (ent.isLoading || !ent.data) return <Skeleton className="h-48" />;

	const e = ent.data;
	const keyMismatch =
		!!keyPair && e.registrada && (keyPair.publicKey[0] !== e.publicKey[0] || keyPair.publicKey[1] !== e.publicKey[1]);

	const items: Item[] = [
		{
			done: !!keyPair,
			title: "Clave de cifrado desbloqueada",
			icon: <KeyRound className="size-4" />,
			desc: keyError ? (
				<span className="text-amber-300">{keyError}</span>
			) : e.registrada ? (
				"Firmás un mensaje (sin gas) y se deriva tu clave BabyJubJub. Sólo vive en memoria."
			) : (
				"Firmás un mensaje (sin gas) dos veces: así comprobamos que tu wallet es compatible antes de registrar la clave."
			),
			action: !keyPair && (
				<Button size="sm" loading={unlocking} onClick={() => unlock().catch(() => {})}>
					Firmar y derivar
				</Button>
			),
		},
		{
			done: e.registrada && !keyMismatch,
			title: "Clave pública registrada en eERC",
			icon: <Fingerprint className="size-4" />,
			desc: keyMismatch ? (
				<span className="text-amber-300">Esta cuenta se registró con otra clave: desde un script, o con una wallet que hoy firma distinto. Volvé a la wallet original o usá otra cuenta.</span>
			) : (
				"Prueba ZK de que conocés la clave privada, ligada a tu dirección y a esta red."
			),
			action: !e.registrada && keyPair && (
				<Button size="sm" onClick={() => run("Registro en eERC", (step) => register(ctx, keyPair, step), "Tu clave pública quedó registrada en el Registrar oficial.")}>
					Registrar
				</Button>
			),
		},
		...(requireKyc
			? [
					{
						done: e.habilitada,
						title: "Entidad habilitada (KYC)",
						icon: <UserCheck className="size-4" />,
						desc: e.habilitada ? (
							"Tu dirección está en la allowlist de Trasluz."
						) : (
							<>
								Pedile al operador que habilite <Addr a={address} /> en <b>Administración</b>.
							</>
						),
					},
				]
			: []),
	];

	if (items.every((i) => i.done)) return <>{children}</>;
	const firstPending = items.findIndex((i) => !i.done);

	return (
		<Card className="overflow-hidden">
			<div className="border-b border-white/[0.06] px-6 py-5">
				<div className="text-xs font-semibold uppercase tracking-[0.18em] text-ava-400">Alta de entidad</div>
				<h3 className="mt-1 text-lg font-semibold text-white">Preparemos tu cuenta de {role}</h3>
			</div>
			<ol className="divide-y divide-white/[0.05]">
				{items.map((it, i) => (
					<li key={it.title} className={`flex flex-wrap items-center gap-4 px-6 py-4 sm:flex-nowrap ${i > firstPending && !it.done ? "opacity-50" : ""}`}>
						<div
							className={`grid size-9 shrink-0 place-items-center rounded-xl ring-1 ${
								it.done ? "bg-clear-500/10 text-clear-400 ring-clear-500/25" : i === firstPending ? "bg-ava-500/10 text-ava-400 ring-ava-500/25" : "bg-white/[0.03] text-ink-400 ring-white/10"
							}`}
						>
							{it.done ? <Check className="size-4" /> : it.icon}
						</div>
						<div className="min-w-0 flex-1">
							<div className="text-sm font-medium text-white">{it.title}</div>
							<div className="mt-0.5 text-[13px] text-ink-400">{it.desc}</div>
						</div>
						{i === firstPending && it.action}
					</li>
				))}
			</ol>
			{e.gas === 0n && (
				<div className="flex items-center gap-2 border-t border-white/[0.06] bg-amber-500/5 px-6 py-3 text-xs text-amber-200">
					<ShieldAlert className="size-4" /> Tu cuenta no tiene AVAX para gas. Pedí en el faucet de Fuji del Builder Hub.
				</div>
			)}
		</Card>
	);
}
