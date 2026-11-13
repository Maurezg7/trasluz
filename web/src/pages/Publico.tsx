import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ExternalLink, Globe2, LockKeyhole, ScanEye, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Cipher } from "../components/Cipher";
import { EstadoBadge } from "../components/Estado";
import { Addr, Badge, Button, Card, CardHeader, Empty, SectionTitle, Skeleton, TxLink } from "../components/ui";
import { useCtx } from "../hooks/useCtx";
import { labelFor } from "../lib/audit";
import { type PrivateTransferLog, fetchEERCLogs, fetchObligaciones } from "../lib/chain";
import { readEncryptedBalance } from "../lib/eerc";
import { explorerTx, fmtDate, fmtUSDC, hexOf } from "../lib/format";

export default function Publico() {
	const { ctx, d } = useCtx();
	const [sel, setSel] = useState<PrivateTransferLog | null>(null);
	const q = useQuery({
		queryKey: ["public", d?.chainId],
		enabled: !!ctx,
		refetchInterval: 15_000,
		queryFn: async () => {
			const [logs, obligaciones] = await Promise.all([fetchEERCLogs(ctx!.pc, ctx!.d), fetchObligaciones(ctx!.pc, ctx!.d)]);
			const vaults = await Promise.all(obligaciones.map((o) => readEncryptedBalance(ctx!, o.vault).catch(() => null)));
			return { logs, obligaciones, vaults };
		},
	});
	const transfers = (q.data?.logs.filter((l) => l.kind === "PrivateTransfer") ?? []) as PrivateTransferLog[];
	const current = sel ?? transfers[0] ?? null;
	const obs = q.data?.obligaciones ?? [];

	return (
		<>
			<SectionTitle eyebrow="Vista pública · lo que ve cualquiera" title="El mercado ve que hubo un pago. No ve cuánto.">
				Emisor, receptor y timestamp son públicos (como en cualquier blockchain). El monto viaja cifrado con ElGamal y Poseidon: en el explorer es ruido. Esta pantalla usa sólo datos públicos de la cadena, sin ninguna clave.
			</SectionTitle>

			{!d && <Card className="p-6 text-sm text-ink-300">Sin deployment en esta red.</Card>}
			{d && (
				<div className="space-y-6">
					<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
						<Card className="min-w-0 overflow-hidden">
							<CardHeader icon={<Globe2 className="size-4" />} title="Transferencias confidenciales" subtitle="Eventos PrivateTransfer del contrato EncryptedERC" />
							{q.isLoading && <Skeleton className="m-5 h-40" />}
							{!q.isLoading && transfers.length === 0 && <Empty icon={<Search className="size-5" />} title="Todavía no hay transferencias" />}
							<div className="divide-y divide-white/[0.05]">
								{transfers.map((t) => {
									const active = current?.txHash === t.txHash && current.logIndex === t.logIndex;
									return (
										<div
											key={`${t.txHash}-${t.logIndex}`}
											role="button"
											tabIndex={0}
											onClick={() => setSel(t)}
											onKeyDown={(e) => e.key === "Enter" && setSel(t)}
											className={`flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left transition ${active ? "bg-ava-500/[0.06]" : "hover:bg-white/[0.02]"}`}
										>
											<div className="flex min-w-[260px] flex-1 items-center gap-2 text-sm">
												<Addr a={t.from} n={3} label={labelFor(t.from, obs)} />
												<ArrowRight className="size-3.5 text-ink-400" />
												<Addr a={t.to} n={3} label={labelFor(t.to, obs)} />
											</div>
											<div className="flex items-center gap-3">
												<span className="text-[11px] uppercase tracking-wider text-ink-400">monto</span>
												<Cipher value={t.auditorPCT[0]} len={14} />
											</div>
										</div>
									);
								})}
							</div>
						</Card>

						<div className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
							<Card className="overflow-hidden">
								<CardHeader
									icon={<LockKeyhole className="size-4" />}
									title="Evento decodificado"
									subtitle="Exactamente lo que muestra Snowtrace"
									action={
										current && d.explorer ? (
											<a href={explorerTx(d.explorer, current.txHash) ?? "#"} target="_blank" rel="noreferrer">
												<Button size="sm" variant="secondary" icon={<ExternalLink className="size-3.5" />}>
													Snowtrace
												</Button>
											</a>
										) : null
									}
								/>
								{current ? (
									<div className="space-y-3 p-5 font-mono text-[12px]">
										<div className="text-ink-400">
											event <span className="text-white">PrivateTransfer</span>(
										</div>
										<div className="pl-4">
											<span className="text-ink-400">from</span> <span className="break-all text-ink-200">{current.from}</span>
										</div>
										<div className="pl-4">
											<span className="text-ink-400">to</span> <span className="break-all text-ink-200">{current.to}</span>
										</div>
										<div className="pl-4">
											<span className="text-ink-400">auditorPCT[7]</span>
											<div className="mt-1.5 space-y-1 rounded-lg border border-amber-500/15 bg-amber-500/[0.04] p-2.5">
												{current.auditorPCT.map((w, i) => (
													<div key={i} className="cipher-text truncate text-[11px]">
														{hexOf(w)}
													</div>
												))}
											</div>
										</div>
										<div className="text-ink-400">)</div>
										<div className="!font-sans rounded-xl border border-white/[0.06] bg-ink-900/70 p-3 text-xs leading-relaxed text-ink-300">
											¿El monto? No está en ningún campo en claro: ni en el evento, ni en el calldata, ni en el estado del SettlementManager. <TxLink hash={current.txHash}>Ver tx</TxLink>
										</div>
									</div>
								) : (
									<Empty icon={<Search className="size-5" />} title="Elegí una transferencia" />
								)}
							</Card>
							<Link to="/auditor">
								<Card className="group flex items-center gap-4 border-clear-500/20 bg-gradient-to-r from-clear-500/[0.08] to-transparent p-5 transition hover:border-clear-500/40">
									<div className="grid size-10 place-items-center rounded-xl bg-clear-500/10 text-clear-400 ring-1 ring-clear-500/25">
										<ScanEye className="size-5" />
									</div>
									<div className="flex-1">
										<div className="text-sm font-semibold text-white">Ver lo mismo con la viewing key</div>
										<div className="text-xs text-ink-400">Portal del auditor: montos reales + reconciliación</div>
									</div>
									<ArrowRight className="size-4 text-clear-400 transition group-hover:translate-x-1" />
								</Card>
							</Link>
						</div>
					</div>

					<Card className="overflow-hidden">
						<CardHeader icon={<Search className="size-4" />} title="Obligaciones on-chain" subtitle="Estado público del SettlementManager — sin montos" />
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="text-left text-[11px] uppercase tracking-wider text-ink-400">
										{["#", "Pagador", "Proveedor", "Estado", "Saldo del vault (ElGamal)", "Actualizada"].map((h) => (
											<th key={h} className="px-5 py-3 font-medium whitespace-nowrap">
												{h}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y divide-white/[0.05]">
									{obs.map((o, i) => {
										const v = q.data?.vaults[i];
										return (
											<tr key={o.id.toString()} className="hover:bg-white/[0.02]">
												<td className="px-5 py-3 font-mono text-white">#{o.id.toString()}</td>
												<td className="px-5 py-3">
													<Addr a={o.pagador} n={3} />
												</td>
												<td className="px-5 py-3">
													<Addr a={o.proveedor} n={3} />
												</td>
												<td className="px-5 py-3">
													<EstadoBadge o={o} />
												</td>
												<td className="px-5 py-3">{v ? <Cipher value={v.eGCT.c2.x} len={16} animate={false} /> : "—"}</td>
												<td className="px-5 py-3 text-xs text-ink-400">{fmtDate(o.actualizadaEn)}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
							{!q.isLoading && obs.length === 0 && <Empty icon={<Search className="size-5" />} title="Sin obligaciones" />}
						</div>
					</Card>

					{q.data && (
						<p className="text-center text-xs text-ink-400">
							Lo único público con monto son los <Badge tone="neutral">depósitos</Badge> y <Badge tone="neutral">retiros</Badge> (rampa USDC ↔ eERC):{" "}
							{fmtUSDC(q.data.logs.filter((l) => l.kind === "Deposit").reduce((a, l) => a + (l.kind === "Deposit" ? l.amount : 0n), 0n))} depositados en total.
						</p>
					)}
				</div>
			)}
		</>
	);
}
