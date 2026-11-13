import { ArrowRight, Building2, Check, FileLock2, Globe2, Lock, PackageCheck, ScanEye, ShieldCheck, Vault } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Reveal, Tilt } from "../components/fx";
import { Hero3D } from "../components/Hero3D";
import { Addr, Badge, Card } from "../components/ui";
import { useDeployment, useEntidades, useObligaciones } from "../hooks/useCtx";

function RoleCard({ to, icon, title, desc, cta }: { to: string; icon: ReactNode; title: string; desc: string; cta: string }) {
	return (
		<Link to={to} className="group block h-full">
			<Tilt className="h-full">
			<Card className="h-full p-6 transition duration-300 group-hover:border-ava-500/30 group-hover:shadow-[0_30px_60px_-30px_rgb(232_65_66/0.45)]">
				<div className="lift grid size-11 place-items-center rounded-xl bg-gradient-to-br from-ava-500/20 to-ava-700/10 text-ava-300 ring-1 ring-ava-500/25">{icon}</div>
				<h3 className="mt-5 text-base font-semibold text-white">{title}</h3>
				<p className="mt-1.5 text-sm leading-relaxed text-ink-400">{desc}</p>
				<div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ava-300">
					{cta} <ArrowRight className="size-4 transition group-hover:translate-x-1" />
				</div>
			</Card>
			</Tilt>
		</Link>
	);
}

const Row = ({ label, publico, auditor }: { label: string; publico: ReactNode; auditor: ReactNode }) => (
	<div className="grid grid-cols-[1.1fr_1fr_1fr] items-center gap-4 px-5 py-3 text-sm">
		<span className="text-ink-300">{label}</span>
		<span>{publico}</span>
		<span>{auditor}</span>
	</div>
);

export default function Home() {
	const d = useDeployment();
	const obs = useObligaciones();
	const ents = useEntidades();
	const liberadas = obs.data?.filter((o) => o.estado === "Liberada").length ?? 0;

	return (
		<div className="space-y-16">
			<section className="relative grid items-center gap-10 pt-4 lg:grid-cols-[1.2fr_1fr]">
				<div className="animate-fade-up">
					<Badge tone="red" dot>
						Track Avalanche · eERC + escrow + auditor designado
					</Badge>
					<h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-[56px]">
						Liquidación B2B <span className="text-flow">confidencial</span>,
						<br />
						con ventana para el regulador.
					</h1>
					<p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-300">
						Pagás a tu proveedor contra entrega. El monto queda <b className="text-white">cifrado on-chain</b> — tu competencia no ve cuánto le pagás a quién — pero un{" "}
						<b className="text-white">auditor designado</b> concilia todo con su viewing key.
					</p>
					<div className="mt-8 flex flex-wrap gap-3">
						<Link
							to="/empresa"
							className="btn-shine inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-ava-400 to-ava-600 px-6 text-[15px] font-medium text-white shadow-[0_10px_30px_-10px_rgb(232_65_66/0.7)] transition hover:brightness-110"
						>
							Empezar como empresa <ArrowRight className="size-4" />
						</Link>
						<Link to="/publico" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 text-[15px] font-medium text-white transition hover:bg-white/[0.08]">
							<Globe2 className="size-4" /> Ver la cadena pública
						</Link>
					</div>
					<div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-400">
						{["Contratos eERC oficiales sin modificar", "Pruebas Groth16 en el navegador", "Cero montos en eventos y reverts"].map((t) => (
							<span key={t} className="inline-flex items-center gap-1.5">
								<Check className="size-3.5 text-clear-400" /> {t}
							</span>
						))}
					</div>
				</div>

				<div className="relative animate-fade-up [animation-delay:120ms]">
					<Hero3D />
				</div>
			</section>

			{d && (
				<Reveal>
				<section className="grid gap-4 sm:grid-cols-3">
					{[
						["Obligaciones on-chain", obs.data?.length ?? "…"],
						["Liquidadas confidencialmente", liberadas],
						["Entidades KYC habilitadas", ents.data?.length ?? "…"],
					].map(([k, v]) => (
						<Tilt key={k as string}>
						<Card className="p-5">
							<div className="text-xs font-medium uppercase tracking-wider text-ink-400">{k}</div>
							<div className="lift mt-2 text-3xl font-semibold tracking-tight text-white">{v}</div>
						</Card>
						</Tilt>
					))}
				</section>
				<div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-400">
					<span className="inline-flex items-center gap-2 text-clear-400">
						<span className="relative flex size-2">
							<span className="absolute inline-flex size-full animate-ping rounded-full bg-clear-400 opacity-60" />
							<span className="relative inline-flex size-2 rounded-full bg-clear-400" />
						</span>
						Datos en vivo de {d.chainId === 43113 ? "Avalanche Fuji" : d.network}
					</span>
					<span className="inline-flex items-center gap-2">
						SettlementManager <Addr a={d.contracts.settlementManager} />
					</span>
				</div>
				</Reveal>
			)}

			<Reveal>
			<section>
				<div className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-ava-400">Elegí tu rol</div>
				<div className="grid gap-4 md:grid-cols-3">
					<RoleCard to="/empresa" icon={<Building2 className="size-5" />} title="Empresa pagadora" desc="Depositá tesorería, creá obligaciones contra factura y fondeá un escrow cifrado. Liberás cuando el proveedor entrega." cta="Pagar confidencial" />
					<RoleCard to="/proveedor" icon={<PackageCheck className="size-5" />} title="Proveedor" desc="Verificá que el escrow está fondeado antes de entregar, confirmá la entrega y cobrá a tu saldo eERC." cta="Cobrar con garantía" />
					<RoleCard to="/auditor" icon={<ScanEye className="size-5" />} title="Auditor / regulador" desc="Cargá la viewing key designada y conciliá cada operación: montos reales, escrow vs. liberado, export CSV." cta="Abrir la ventana" />
				</div>
			</section>
			</Reveal>

			<Reveal>
			<section className="cv-auto grid gap-6 lg:grid-cols-2">
				<Card className="overflow-hidden">
					<div className="border-b border-white/[0.06] px-5 py-4">
						<h3 className="text-[15px] font-semibold text-white">Quién ve qué</h3>
						<p className="mt-0.5 text-[13px] text-ink-400">Divulgación selectiva, no opacidad total</p>
					</div>
					<div className="grid grid-cols-[1.1fr_1fr_1fr] gap-4 border-b border-white/[0.06] bg-white/[0.02] px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-400">
						<span>Dato</span>
						<span>Mercado</span>
						<span>Auditor</span>
					</div>
					<div className="divide-y divide-white/[0.05]">
						<Row label="Pagador y proveedor" publico={<Badge tone="neutral">visible</Badge>} auditor={<Badge tone="green">visible</Badge>} />
						<Row label="Estado y timestamps" publico={<Badge tone="neutral">visible</Badge>} auditor={<Badge tone="green">visible</Badge>} />
						<Row label="Monto de cada pago" publico={<Badge tone="amber"><Lock className="size-3" /> cifrado</Badge>} auditor={<Badge tone="green">descifrado</Badge>} />
						<Row label="Saldos / flujo de caja" publico={<Badge tone="amber"><Lock className="size-3" /> cifrado</Badge>} auditor={<Badge tone="green">conciliable</Badge>} />
						<Row label="Factura" publico={<Badge tone="neutral">hash + salt</Badge>} auditor={<Badge tone="neutral">hash + salt</Badge>} />
						<Row label="Depósito / retiro USDC" publico={<Badge tone="neutral">visible (rampa)</Badge>} auditor={<Badge tone="green">visible</Badge>} />
					</div>
				</Card>

				<Card className="overflow-hidden">
					<div className="border-b border-white/[0.06] px-5 py-4">
						<h3 className="text-[15px] font-semibold text-white">Cómo funciona</h3>
						<p className="mt-0.5 text-[13px] text-ink-400">SettlementManager compone sobre el EncryptedERC oficial</p>
					</div>
					<ol className="space-y-4 p-5">
						{[
							[<FileLock2 key="a" className="size-4" />, "Crear", "La empresa crea la obligación. Se despliega un vault de escrow (clon EIP-1167) con su propia cuenta eERC."],
							[<Vault key="b" className="size-4" />, "Fondear", "Transferencia eERC confidencial empresa → vault. El proveedor descifra la clave del vault y verifica el monto."],
							[<PackageCheck key="c" className="size-4" />, "Entregar", "El proveedor confirma la entrega. Desde acá la empresa ya no puede cancelar."],
							[<ShieldCheck key="d" className="size-4" />, "Liberar", "Transferencia eERC vault → proveedor. El destino lo fija el contrato y la prueba ZK queda ligada a la clave del proveedor."],
						].map(([icon, t, desc], i) => (
							<li key={t as string} className="flex gap-4">
								<div className="relative">
									<div className="grid size-9 place-items-center rounded-xl bg-white/[0.04] text-ava-400 ring-1 ring-white/[0.08]">{icon}</div>
									{i < 3 && <div className="absolute top-10 left-1/2 h-4 w-px -translate-x-1/2 bg-white/10" />}
								</div>
								<div>
									<div className="text-sm font-medium text-white">
										{i + 1}. {t}
									</div>
									<div className="mt-0.5 text-[13px] leading-relaxed text-ink-400">{desc}</div>
								</div>
							</li>
						))}
					</ol>
				</Card>
			</section>
			</Reveal>

			<Reveal>
			<section className="cv-auto">
				<Card className="grid gap-px overflow-hidden bg-white/[0.05] md:grid-cols-3">
					{[
						["No forkeamos la cripto", "Registrar, EncryptedERC y verifiers de producción de ava-labs, tal cual. Trasluz sólo los llama."],
						["Ningún monto se filtra", "Ni en eventos, ni en reverts, ni en calldata del SettlementManager: el contrato nunca conoce el monto."],
						["Escrow que no se puede desviar", "La clave del vault no es autoridad de gasto: sólo el SettlementManager lo mueve, con destino fijo y CEI + nonReentrant."],
					].map(([t, desc]) => (
						<div key={t} className="bg-ink-850 p-6">
							<div className="flex items-center gap-2 text-sm font-semibold text-white">
								<ShieldCheck className="size-4 text-clear-400" /> {t}
							</div>
							<p className="mt-2 text-[13px] leading-relaxed text-ink-400">{desc}</p>
						</div>
					))}
				</Card>
			</section>
			</Reveal>
		</div>
	);
}
