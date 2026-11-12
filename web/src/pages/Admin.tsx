import { FileCode2, ShieldCheck, UserMinus, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { type Address, isAddress } from "viem";
import { SecurityPanel } from "../components/SecurityPanel";
import { Addr, Badge, Button, Card, CardHeader, Empty, Field, SectionTitle, Skeleton } from "../components/ui";
import { useCtx, useEntidades, useEntity } from "../hooks/useCtx";
import { setEntidad } from "../lib/eerc";
import { useAction } from "../state/action";

const LABELS: Record<string, string> = {
	settlementManager: "SettlementManager (Trasluz)",
	encryptedERC: "EncryptedERC (oficial, converter)",
	registrar: "Registrar (oficial)",
	usdc: "Mock USDC",
	vaultImplementation: "EscrowVault (implementación)",
	babyJubJub: "BabyJubJub (lib)",
	registrationVerifier: "RegistrationVerifier (prod)",
	transferVerifier: "TransferVerifier (prod)",
	withdrawVerifier: "WithdrawVerifier (prod)",
	mintVerifier: "MintVerifier (prod)",
	burnVerifier: "BurnVerifier (prod)",
};

export default function Admin() {
	const { ctx, d, address } = useCtx();
	const ent = useEntity(address);
	const entidades = useEntidades();
	const { run } = useAction();
	const [nueva, setNueva] = useState("");
	const isOwner = !!ent.data?.isOwner;

	return (
		<>
			<SectionTitle eyebrow="Administración" title="Allowlist KYC, contratos y seguridad">
				El owner del SettlementManager habilita entidades. En producción ese rol es un multisig (Safe) detrás de un timelock; acá es una cuenta para la demo.
			</SectionTitle>
			{!d ? (
				<Card className="p-6 text-sm text-ink-300">Sin deployment en esta red.</Card>
			) : (
				<div className="grid items-start gap-6 lg:grid-cols-2">
					<Card>
						<CardHeader
							icon={<Users className="size-4" />}
							title="Entidades habilitadas"
							subtitle="Sólo ellas pueden crear o recibir obligaciones"
							action={isOwner ? <Badge tone="green" dot>Sos owner</Badge> : <Badge tone="neutral">Solo lectura</Badge>}
						/>
						{isOwner && ctx && (
							<form
								className="flex items-end gap-2 border-b border-white/[0.06] p-5"
								onSubmit={(e) => {
									e.preventDefault();
									run("Habilitar entidad", () => setEntidad(ctx, nueva as Address, true), "Entidad agregada a la allowlist.").then((ok) => ok && setNueva(""));
								}}
							>
								<div className="flex-1">
									<Field label="Nueva entidad">
										<input className="input font-mono" placeholder="0x…" value={nueva} onChange={(e) => setNueva(e.target.value)} />
									</Field>
								</div>
								<Button type="submit" disabled={!isAddress(nueva)} icon={<UserPlus className="size-4" />}>
									Habilitar
								</Button>
							</form>
						)}
						{entidades.isLoading && <Skeleton className="m-5 h-24" />}
						{entidades.data?.length === 0 && <Empty icon={<Users className="size-5" />} title="Sin entidades habilitadas" />}
						<ul className="divide-y divide-white/[0.05]">
							{entidades.data?.map((a) => (
								<li key={a} className="flex items-center justify-between px-5 py-3">
									<Addr a={a} n={6} />
									{isOwner && ctx && (
										<Button size="sm" variant="ghost" icon={<UserMinus className="size-3.5" />} onClick={() => run("Deshabilitar entidad", () => setEntidad(ctx, a, false), "Entidad removida de la allowlist.")}>
											Quitar
										</Button>
									)}
								</li>
							))}
						</ul>
					</Card>

					<div className="space-y-6">
						<SecurityPanel />
						<Card>
							<CardHeader icon={<ShieldCheck className="size-4" />} title="Roles" />
							<dl className="divide-y divide-white/[0.05] text-sm">
								<div className="flex items-center justify-between px-5 py-3">
									<dt className="text-ink-400">Owner / operador</dt>
									<dd>
										<Addr a={d.owner} />
									</dd>
								</div>
								<div className="flex items-center justify-between px-5 py-3">
									<dt className="text-ink-400">Auditor designado (eERC)</dt>
									<dd>
										<Addr a={d.auditor} />
									</dd>
								</div>
								<div className="flex items-center justify-between px-5 py-3">
									<dt className="text-ink-400">Red</dt>
									<dd className="text-white">
										{d.network} <span className="text-ink-400">· chainId {d.chainId}</span>
									</dd>
								</div>
							</dl>
						</Card>
						<Card>
							<CardHeader icon={<FileCode2 className="size-4" />} title="Contratos desplegados" subtitle={`Bloque ${d.deployBlock} · ${new Date(d.deployedAt).toLocaleString("es-AR")}`} />
							<dl className="divide-y divide-white/[0.05] text-sm">
								{Object.entries(d.contracts).map(([k, v]) => (
									<div key={k} className="flex items-center justify-between gap-4 px-5 py-2.5">
										<dt className="text-ink-300">{LABELS[k] ?? k}</dt>
										<dd>
											<Addr a={v} />
										</dd>
									</div>
								))}
							</dl>
						</Card>
					</div>
				</div>
			)}
		</>
	);
}
