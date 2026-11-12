import { keyDerivationMessage, parseViewingKey } from "@trasluz/zk/src/pure";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, Eye, EyeOff, KeyRound, Lock, RefreshCw, ScanEye, Scale, ShieldCheck, Vault } from "lucide-react";
import { useMemo, useState } from "react";
import { keccak256 } from "viem";
import { useAccount, useSignMessage } from "wagmi";
import { Cipher } from "../components/Cipher";
import { EstadoBadge } from "../components/Estado";
import { DecryptText } from "../components/fx";
import { LogoMark } from "../components/Logo";
import { Addr, Badge, Button, Card, Empty, SectionTitle, Skeleton, Stat, TxLink, type Tone } from "../components/ui";
import { useAutoLock } from "../hooks/useAutoLock";
import { useCtx } from "../hooks/useCtx";
import { type Conciliacion, auditar, labelFor, pctsOf, toCSV } from "../lib/audit";
import { zk } from "../lib/prover";
import { fetchEERCLogs, fetchObligaciones } from "../lib/chain";
import { getAuditorPublicKey } from "../lib/eerc";
import { fmtUSDC, sameAddr } from "../lib/format";

const CONC_TONE: Record<Conciliacion["estado"], Tone> = {
	Concilia: "green",
	Reembolsada: "green",
	"En escrow": "amber",
	"Pendiente de fondeo": "blue",
	Remanente: "violet",
	Discrepancia: "red",
};

function KeyLoader({ onKey }: { onKey: (k: bigint) => void }) {
	const { ctx, d } = useCtx();
	const { address } = useAccount();
	const { signMessageAsync } = useSignMessage();
	const [input, setInput] = useState("");
	const [show, setShow] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const validate = async (priv: bigint) => {
		if (!ctx) throw new Error("Red no soportada");
		const expected = await getAuditorPublicKey(ctx);
		const kp = await zk.keyFromPrivate(priv);
		if (kp.publicKey[0] !== expected[0] || kp.publicKey[1] !== expected[1]) {
			throw new Error("Esta clave no corresponde al auditor designado en el contrato eERC.");
		}
		onKey(priv);
	};

	const fromInput = async () => {
		setErr(null);
		setBusy(true);
		try {
			await validate(parseViewingKey(input));
			setInput("");
		} catch (e) {
			setErr((e as Error).message);
		} finally {
			setBusy(false);
		}
	};

	const fromWallet = async () => {
		if (!address || !d) return;
		setErr(null);
		setBusy(true);
		try {
			const sig = await signMessageAsync({ message: keyDerivationMessage(address, d.chainId) });
			await validate((await zk.keyFromSeed(BigInt(keccak256(sig)))).privateKey);
		} catch (e) {
			setErr((e as Error).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card className="grid-bg relative overflow-hidden">
			<div className="pointer-events-none absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(232_65_66/0.14),transparent)]" />
			<div className="relative mx-auto max-w-lg px-6 py-14 text-center">
				<LogoMark size={88} className="mx-auto drop-shadow-[0_0_30px_rgb(232_65_66/0.35)]" />
				<h2 className="mt-6 text-xl font-semibold text-white">Abrí la ventana del regulador</h2>
				<p className="mt-2 text-sm text-ink-400">
					Cargá la <b className="text-ink-200">viewing key</b> del auditor designado. Se valida contra la clave pública registrada en el contrato eERC y se usa para descifrar localmente los montos.
				</p>
				<form
					className="mt-7 flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						fromInput();
					}}
				>
					<div className="relative flex-1">
						<KeyRound className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" />
						<input
							className="input pl-10 pr-10 font-mono"
							type={show ? "text" : "password"}
							autoComplete="off"
							spellCheck={false}
							placeholder="0x… viewing key"
							value={input}
							onChange={(e) => setInput(e.target.value)}
						/>
						<button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-400 hover:text-white">
							{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
						</button>
					</div>
					<Button type="submit" loading={busy} disabled={!input} icon={<ScanEye className="size-4" />}>
						Abrir
					</Button>
				</form>
				{address && sameAddr(address, d?.auditor) && (
					<button type="button" onClick={fromWallet} className="mt-3 text-xs text-ink-400 underline-offset-4 hover:text-white hover:underline">
						Soy el auditor y registré mi clave desde la app → derivar con mi wallet
					</button>
				)}
				{err && (
					<div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
						<AlertTriangle className="size-4" /> {err}
					</div>
				)}
				<div className="mt-8 flex items-center justify-center gap-2 text-[11.5px] text-ink-400">
					<Lock className="size-3.5" /> La clave vive sólo en la memoria de esta pestaña: no se guarda, no se envía, no se loguea.
				</div>
			</div>
		</Card>
	);
}

export default function Auditor() {
	const { ctx, d } = useCtx();
	const [viewingKey, setViewingKeyRaw] = useState<bigint | null>(null);
	// Epoch opaco para las cache keys: la viewing key nunca entra a react-query.
	const [epoch, setEpoch] = useState(0);
	const setViewingKey = (k: bigint | null) => {
		setViewingKeyRaw(k);
		setEpoch((e) => e + 1);
	};
	const [tab, setTab] = useState<"conc" | "ledger">("conc");
	// La viewing key se borra sola: 10 min sin actividad o 2 min con la pestaña oculta.
	useAutoLock(viewingKey !== null, () => setViewingKey(null), { idleMs: 10 * 60_000, hiddenMs: 2 * 60_000 });

	const data = useQuery({
		queryKey: ["audit-data", d?.chainId],
		enabled: !!ctx && viewingKey !== null,
		refetchInterval: 15_000,
		queryFn: async () => {
			const [logs, obligaciones] = await Promise.all([fetchEERCLogs(ctx!.pc, ctx!.d), fetchObligaciones(ctx!.pc, ctx!.d)]);
			return { logs, obligaciones };
		},
	});

	// Descifrado en el worker (fuera del hilo de UI), conciliación en memoria.
	const decrypted = useQuery({
		queryKey: ["audit-decrypt", d?.chainId, data.dataUpdatedAt, epoch],
		enabled: viewingKey !== null && !!data.data,
		queryFn: () => zk.decryptPCTs(viewingKey!, pctsOf(data.data!.logs).map((p) => p ?? [0n, 0n, 0n, 0n, 0n, 0n, 0n])),
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: 0,
	});
	const audit = useMemo(
		() => (viewingKey !== null && data.data && decrypted.data ? auditar(decrypted.data, data.data.logs, data.data.obligaciones) : null),
		[viewingKey, data.data, decrypted.data],
	);

	const exportCSV = () => {
		if (!audit) return;
		const csv = toCSV(audit.conc, audit.movs, (v) => fmtUSDC(v, { symbol: false }).replace(/\./g, "").replace(",", "."));
		const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
		const a = document.createElement("a");
		a.href = url;
		a.download = `trasluz-reconciliacion-${d?.network}-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<>
			<SectionTitle eyebrow="Portal del auditor · solo lectura" title="Confidencial para el mercado, transparente para el regulador">
				Con la viewing key designada en el contrato eERC se descifran todos los montos y se concilia cada obligación: lo fondeado en escrow contra lo liberado al proveedor.
			</SectionTitle>

			{!d && <Card className="p-6 text-sm text-ink-300">Conectate a una red con deployment para auditar.</Card>}
			{d && viewingKey === null && <KeyLoader onKey={setViewingKey} />}

			{d && viewingKey !== null && (
				<div className="space-y-6">
					<Card className="ring-glow flex flex-wrap items-center gap-4 border-clear-500/20 bg-gradient-to-r from-clear-500/[0.07] to-transparent px-5 py-4">
						<LogoMark size={40} open />
						<div className="flex-1">
							<div className="text-sm font-semibold text-white">Ventana abierta</div>
							<div className="text-xs text-ink-400">
								Auditor designado <Addr a={d.auditor} /> · clave verificada contra <span className="font-mono">eERC.auditorPublicKey</span>
							</div>
						</div>
						<Button size="sm" variant="ghost" icon={<RefreshCw className={`size-3.5 ${data.isFetching ? "animate-spin" : ""}`} />} onClick={() => data.refetch()}>
							Actualizar
						</Button>
						<Button size="sm" variant="secondary" icon={<Download className="size-3.5" />} onClick={exportCSV} disabled={!audit}>
							Exportar CSV
						</Button>
						<Button size="sm" variant="danger" icon={<Lock className="size-3.5" />} onClick={() => setViewingKey(null)}>
							Cerrar ventana
						</Button>
					</Card>

					{!audit ? (
						<div className="grid gap-4 md:grid-cols-4">
							{[0, 1, 2, 3].map((i) => (
								<Skeleton key={i} className="h-28" />
							))}
						</div>
					) : (
						<>
							<div className="grid gap-4 md:grid-cols-4">
								<Stat label="Liquidado a proveedores" value={<DecryptText className="clear-text" text={fmtUSDC(audit.totales.liquidado, { symbol: false })} />} hint="USDC · confidencial on-chain" icon={<CheckCircle2 className="size-4" />} tone="green" />
								<Stat label="En escrow" value={<DecryptText text={fmtUSDC(audit.totales.enEscrow, { symbol: false })} />} hint="USDC en vaults" icon={<Vault className="size-4" />} />
								<Stat label="Conciliación" value={`${audit.totales.conciliadas}/${audit.conc.length}`} hint={audit.totales.discrepancias ? `${audit.totales.discrepancias} discrepancias` : "sin discrepancias"} icon={<Scale className="size-4" />} tone={audit.totales.discrepancias ? "red" : "green"} />
								<Stat label="Rampa pública" value={fmtUSDC(audit.totales.depositos, { symbol: false })} hint={`depósitos · ${fmtUSDC(audit.totales.retiros, { symbol: false })} retiros`} icon={<ShieldCheck className="size-4" />} />
							</div>

							<Card className="overflow-hidden">
								<div className="flex items-center gap-1 border-b border-white/[0.06] px-3 pt-3">
									{(
										[
											["conc", "Reconciliación por obligación"],
											["ledger", "Libro de movimientos"],
										] as const
									).map(([k, label]) => (
										<button
											key={k}
											type="button"
											onClick={() => setTab(k)}
											className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${tab === k ? "bg-white/[0.06] text-white" : "text-ink-400 hover:text-white"}`}
										>
											{label}
										</button>
									))}
								</div>

								{tab === "conc" && (
									<div className="overflow-x-auto">
										{audit.conc.length === 0 ? (
											<Empty icon={<Scale className="size-5" />} title="Sin obligaciones todavía" />
										) : (
											<table className="w-full text-sm">
												<thead>
													<tr className="text-left text-[11px] uppercase tracking-wider text-ink-400">
														{["#", "Pagador → Proveedor", "Estado", "Fondeado", "Liberado", "Reembolsado", "En escrow", "Conciliación"].map((h) => (
															<th key={h} className="px-4 py-3 font-medium whitespace-nowrap">
																{h}
															</th>
														))}
													</tr>
												</thead>
												<tbody className="divide-y divide-white/[0.05]">
													{audit.conc.map((c) => (
														<tr key={c.o.id.toString()} className="animate-fade-up hover:bg-white/[0.02]">
															<td className="px-4 py-3 font-mono text-white">#{c.o.id.toString()}</td>
															<td className="px-4 py-3">
																<div className="flex items-center gap-2">
																	<Addr a={c.o.pagador} n={3} />
																	<ArrowRight className="size-3.5 text-ink-400" />
																	<Addr a={c.o.proveedor} n={3} />
																</div>
															</td>
															<td className="px-4 py-3">
																<EstadoBadge o={c.o} />
															</td>
															{[c.fondeado, c.liberado, c.reembolsado, c.enEscrow].map((v, i) => (
																<td key={i} className={`px-4 py-3 font-mono whitespace-nowrap ${v ? "clear-text" : "text-ink-400"}`}>
																	<DecryptText text={fmtUSDC(v, { symbol: false })} />
																</td>
															))}
															<td className="px-4 py-3">
																<Badge tone={CONC_TONE[c.estado]} dot>
																	{c.estado}
																</Badge>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										)}
									</div>
								)}

								{tab === "ledger" && (
									<div className="overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="text-left text-[11px] uppercase tracking-wider text-ink-400">
													{["Tx", "Tipo", "Desde → Hacia", "On-chain (público)", "Descifrado (auditor)"].map((h) => (
														<th key={h} className="px-4 py-3 font-medium whitespace-nowrap">
															{h}
														</th>
													))}
												</tr>
											</thead>
											<tbody className="divide-y divide-white/[0.05]">
												{audit.movs.map((m) => {
													const obs = data.data?.obligaciones ?? [];
													return (
														<tr key={`${m.txHash}-${m.logIndex}`} className="hover:bg-white/[0.02]">
															<td className="px-4 py-3">
																<TxLink hash={m.txHash} />
															</td>
															<td className="px-4 py-3">
																{m.kind === "PrivateTransfer" ? (
																	<Badge tone="red">{m.rol ? `${{ fondeo: "fondeo", liberacion: "liberación", reembolso: "reembolso" }[m.rol]} #${m.obligacionId}` : "transferencia"}</Badge>
																) : m.kind === "Deposit" ? (
																	<Badge tone="neutral">depósito</Badge>
																) : (
																	<Badge tone="neutral">retiro</Badge>
																)}
															</td>
															<td className="px-4 py-3">
																{m.kind === "PrivateTransfer" ? (
																	<div className="flex items-center gap-2">
																		<Addr a={m.from} n={3} label={labelFor(m.from, obs)} />
																		<ArrowRight className="size-3.5 text-ink-400" />
																		<Addr a={m.to} n={3} label={labelFor(m.to, obs)} />
																	</div>
																) : (
																	<Addr a={m.user} n={3} />
																)}
															</td>
															<td className="px-4 py-3">
																{m.kind === "PrivateTransfer" ? (
																	<Cipher value={m.auditorPCT[0]} len={16} animate={false} />
																) : (
																	<span className="font-mono text-ink-300">{fmtUSDC(m.kind === "Deposit" ? m.amount : m.amount ?? 0n)}</span>
																)}
															</td>
															<td className="px-4 py-3 whitespace-nowrap">
																{m.error ? (
																	<Badge tone="amber">no descifrable con esta clave</Badge>
																) : (
																	<DecryptText className="clear-text font-semibold" text={fmtUSDC(m.amount ?? 0n)} />
																)}
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
										{audit.movs.length === 0 && <Empty icon={<ScanEye className="size-5" />} title="Sin movimientos" />}
									</div>
								)}
							</Card>
							<p className="text-center text-[11.5px] text-ink-400">
								Los montos se descifran del <span className="font-mono">auditorPCT</span> (Poseidon) que el circuito oficial obliga a incluir en cada transferencia — {audit.movs.length} eventos procesados localmente.
							</p>
						</>
					)}
				</div>
			)}
		</>
	);
}
