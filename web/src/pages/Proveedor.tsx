import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Inbox, PackageCheck, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { Amount } from "../components/Cipher";
import { Gate } from "../components/Gate";
import { ObligacionCard } from "../components/ObligacionCard";
import { Treasury } from "../components/Treasury";
import { Badge, Button, Card, Empty, SectionTitle, Skeleton } from "../components/ui";
import { useCtx, useObligaciones } from "../hooks/useCtx";
import type { Obligacion } from "../lib/chain";
import { confirmarEntrega, verificarFondeo } from "../lib/eerc";
import { sameAddr } from "../lib/format";
import { useAction } from "../state/action";
import { useKeys } from "../state/keys";

function ACobrar({ o }: { o: Obligacion }) {
	const { ctx, d } = useCtx();
	const { keyPair } = useKeys();
	const { run } = useAction();
	const escrow = useQuery({
		queryKey: ["escrow-prov", d?.chainId, o.id.toString(), o.estado],
		enabled: !!ctx && !!keyPair && o.estado !== "Inexistente",
		queryFn: () => verificarFondeo(ctx!, keyPair!, o.id, o.vault),
	});
	if (!ctx || !keyPair) return null;
	const v = escrow.data?.balance;

	const actions =
		o.estado === "Fondeada" && !o.entregaConfirmada ? (
			<Button
				size="sm"
				variant="success"
				icon={<PackageCheck className="size-3.5" />}
				onClick={() => run("Confirmar entrega", () => confirmarEntrega(ctx, o.id), "Entrega confirmada. El pagador ya puede liberar el pago (y no puede cancelar).")}
			>
				Confirmar entrega
			</Button>
		) : o.estado === "Fondeada" ? (
			<Badge tone="violet">Esperando liberación</Badge>
		) : o.estado === "Liberada" ? (
			<Badge tone="green">
				<BadgeCheck className="size-3" /> Cobrado
			</Badge>
		) : o.estado === "Creada" ? (
			<Badge tone="blue">Esperando fondeo</Badge>
		) : null;

	return (
		<ObligacionCard
			o={o}
			contraparte={o.pagador}
			contraparteLabel="Pagador"
			highlight={o.estado === "Fondeada" && !o.entregaConfirmada}
			monto={
				escrow.isLoading ? (
					<Skeleton className="h-5 w-28" />
				) : o.estado === "Fondeada" && v !== undefined ? (
					<div className="flex flex-col items-end gap-1">
						<Amount value={v} size="lg" />
						<span className="inline-flex items-center gap-1 text-[11px] text-clear-400">
							<ShieldCheck className="size-3" /> escrow verificado
						</span>
					</div>
				) : (
					<Amount value={o.estado === "Liberada" ? null : v} size="lg" />
				)
			}
			actions={actions}
		/>
	);
}

export default function Proveedor() {
	const { address } = useCtx();
	const obs = useObligaciones();
	const mias = useMemo(() => (obs.data ?? []).filter((o) => sameAddr(o.proveedor, address)), [obs.data, address]);
	const pendientes = mias.filter((o) => o.estado === "Fondeada" && !o.entregaConfirmada).length;
	return (
		<>
			<SectionTitle eyebrow="Proveedor" title="Cobrá con garantía, sin exponer tu facturación">
				Antes de entregar verificás que el escrow está fondeado (descifrás el vault con la clave que el pagador cifró para vos). Al liberar, el pago llega a tu saldo eERC.
			</SectionTitle>
			<Gate role="proveedor">
				<div className="space-y-6">
					<Treasury title="Cobros" />
					<div className="flex items-center justify-between">
						<h2 className="text-sm font-semibold text-white">Obligaciones a tu favor</h2>
						{pendientes > 0 && <Badge tone="red" dot>{pendientes} por confirmar</Badge>}
					</div>
					{obs.isLoading && <Skeleton className="h-40" />}
					{!obs.isLoading && mias.length === 0 && (
						<Card>
							<Empty icon={<Inbox className="size-5" />} title="No hay obligaciones a tu favor">
								Cuando una empresa cree una obligación hacia tu dirección, aparece acá. El monto sólo lo ven vos, el pagador y el auditor.
							</Empty>
						</Card>
					)}
					<div className="space-y-4">
						{mias.map((o) => (
							<ACobrar key={o.id.toString()} o={o} />
						))}
					</div>
					{mias.some((o) => o.estado === "Liberada") && (
						<p className="text-center text-xs text-ink-400">
							Lo cobrado ya forma parte de tu saldo confidencial ({mias.filter((o) => o.estado === "Liberada").length} pagos). Podés retirarlo a USDC cuando quieras; el monto sólo se vuelve público al retirar.
						</p>
					)}
				</div>
			</Gate>
		</>
	);
}
