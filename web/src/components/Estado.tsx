import { Ban, Check } from "lucide-react";
import type { Obligacion } from "../lib/chain";
import { Badge, type Tone } from "./ui";

const TONE: Record<string, Tone> = { Creada: "blue", Fondeada: "amber", Liberada: "green", Cancelada: "neutral", Inexistente: "neutral" };

export function EstadoBadge({ o }: { o: Pick<Obligacion, "estado" | "entregaConfirmada"> }) {
	const label = o.estado === "Fondeada" && o.entregaConfirmada ? "Entregada" : o.estado;
	return (
		<Badge tone={o.estado === "Fondeada" && o.entregaConfirmada ? "violet" : TONE[o.estado]} dot>
			{label}
		</Badge>
	);
}

/** Línea de tiempo de la máquina de estados: Creada → Fondeada → Entregada → Liberada. */
export function EstadoTimeline({ o }: { o: Pick<Obligacion, "estado" | "entregaConfirmada"> }) {
	const steps = ["Creada", "Fondeada", "Entregada", "Liberada"];
	const reached =
		o.estado === "Liberada" ? 4 : o.estado === "Fondeada" ? (o.entregaConfirmada ? 3 : 2) : o.estado === "Creada" ? 1 : 0;
	if (o.estado === "Cancelada") {
		return (
			<div className="flex items-center gap-2 text-xs text-ink-400">
				<Ban className="size-3.5" /> Cancelada por el pagador
			</div>
		);
	}
	return (
		<div className="flex items-center">
			{steps.map((s, i) => {
				const done = i < reached;
				const current = i === reached - 1;
				return (
					<div key={s} className="flex items-center">
						<div className="flex flex-col items-center gap-1.5">
							<div
								className={`grid size-6 place-items-center rounded-full text-[10px] font-bold ring-1 transition ${
									done ? "bg-clear-500/15 text-clear-400 ring-clear-500/40" : "bg-white/[0.03] text-ink-400 ring-white/10"
								} ${current ? "shadow-[0_0_16px_rgb(16_185_129/0.45)]" : ""}`}
							>
								{done ? <Check className="size-3.5" /> : i + 1}
							</div>
							<span className={`text-[10.5px] font-medium ${done ? "text-ink-200" : "text-ink-400"}`}>{s}</span>
						</div>
						{i < steps.length - 1 && <div className={`mx-1.5 mb-5 h-px w-8 sm:w-12 ${i < reached - 1 ? "bg-clear-500/50" : "bg-white/10"}`} />}
					</div>
				);
			})}
		</div>
	);
}
