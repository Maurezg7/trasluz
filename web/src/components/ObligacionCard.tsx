import { FileLock2, Vault } from "lucide-react";
import type { ReactNode } from "react";
import type { Obligacion } from "../lib/chain";
import { fmtDate, short } from "../lib/format";
import { EstadoBadge, EstadoTimeline } from "./Estado";
import { Addr, Card } from "./ui";

export function ObligacionCard({
	o,
	contraparte,
	contraparteLabel,
	factura,
	monto,
	actions,
	highlight,
}: {
	o: Obligacion;
	contraparte: string;
	contraparteLabel: string;
	factura?: string | null;
	monto: ReactNode;
	actions?: ReactNode;
	highlight?: boolean;
}) {
	return (
		<Card className={`animate-fade-up overflow-hidden transition ${highlight ? "ring-1 ring-ava-500/40 shadow-[0_0_40px_-12px_rgb(232_65_66/0.5)]" : ""}`}>
			<div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
				<div className="flex items-start gap-3">
					<div className="grid size-10 place-items-center rounded-xl bg-white/[0.04] font-mono text-sm font-semibold text-white ring-1 ring-white/[0.08]">
						#{o.id.toString()}
					</div>
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-[15px] font-semibold text-white">{factura || "Factura " + short(o.refFactura, 6)}</span>
							<EstadoBadge o={o} />
						</div>
						<div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
							<span className="inline-flex items-center gap-1.5">
								{contraparteLabel}: <Addr a={contraparte} />
							</span>
							<span className="inline-flex items-center gap-1.5">
								<Vault className="size-3.5" /> Vault <Addr a={o.vault} />
							</span>
							<span>{fmtDate(o.creadaEn)}</span>
						</div>
					</div>
				</div>
				<div className="text-right">
					<div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">Monto</div>
					<div className="mt-1">{monto}</div>
				</div>
			</div>
			<div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] bg-ink-900/40 px-5 py-4">
				<EstadoTimeline o={o} />
				<div className="flex flex-wrap items-center gap-2">{actions}</div>
			</div>
			<div className="flex items-center gap-1.5 border-t border-white/[0.04] px-5 py-2 text-[11px] text-ink-400">
				<FileLock2 className="size-3" /> refFactura <span className="font-mono">{short(o.refFactura, 10)}</span>
			</div>
		</Card>
	);
}
