import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Cpu, FileCheck2, KeyRound, Loader2, ShieldAlert, ShieldCheck, TimerReset } from "lucide-react";
import { zk } from "../lib/prover";
import { Badge, Button, Card, CardHeader } from "./ui";

/** Postura de seguridad del cliente, verificable en vivo durante la demo. */
export function SecurityPanel() {
	const q = useQuery({ queryKey: ["zk-integrity"], queryFn: () => zk.integrity(), enabled: false, staleTime: Number.POSITIVE_INFINITY });
	const allOk = q.data?.every((f) => f.ok);
	const items = [
		{ icon: <Cpu className="size-4" />, t: "Criptografía aislada en Web Worker", d: "Claves, cifrado y pruebas Groth16 fuera del hilo de UI; el bundle principal no incluye curvas ni snarkjs." },
		{ icon: <KeyRound className="size-4" />, t: "Claves sólo en memoria", d: "Derivadas de una firma determinística; nunca en storage, logs ni cache keys." },
		{ icon: <TimerReset className="size-4" />, t: "Auto-bloqueo", d: "Clave eERC: 15 min inactivo / 5 min oculta. Viewing key: 10 min / 2 min." },
		{ icon: <ShieldCheck className="size-4" />, t: "CSP estricta + headers", d: "Sin scripts inline ni eval (sólo wasm-unsafe-eval), frame-ancestors 'none', no-referrer, HSTS." },
	];
	return (
		<Card>
			<CardHeader
				icon={<ShieldCheck className="size-4" />}
				title="Seguridad del cliente"
				subtitle="Lo que protege a las claves en el navegador"
				action={q.data ? <Badge tone={allOk ? "green" : "red"} dot>{allOk ? "Circuitos íntegros" : "¡Integridad fallida!"}</Badge> : null}
			/>
			<ul className="divide-y divide-white/[0.05]">
				{items.map((i) => (
					<li key={i.t} className="flex gap-3 px-5 py-3">
						<span className="mt-0.5 text-clear-400">{i.icon}</span>
						<div>
							<div className="text-sm font-medium text-white">{i.t}</div>
							<div className="text-[12.5px] text-ink-400">{i.d}</div>
						</div>
					</li>
				))}
			</ul>
			<div className="border-t border-white/[0.06] p-5">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2 text-sm font-medium text-white">
						<FileCheck2 className="size-4 text-ava-400" /> Integridad de circuitos (SHA-256 fijado en build)
					</div>
					<Button size="sm" variant="secondary" loading={q.isFetching} onClick={() => q.refetch()}>
						Verificar ahora
					</Button>
				</div>
				{q.data && (
					<ul className="mt-3 space-y-1.5">
						{q.data.map((f) => (
							<li key={f.url} className="flex items-center gap-2 font-mono text-[11.5px]">
								{f.ok ? <CheckCircle2 className="size-3.5 shrink-0 text-clear-400" /> : <ShieldAlert className="size-3.5 shrink-0 text-red-400" />}
								<span className="w-56 shrink-0 truncate text-ink-200">{f.url.replace("/zk/", "")}</span>
								<span className="truncate text-ink-400">{f.sha256}</span>
							</li>
						))}
					</ul>
				)}
				{q.isFetching && !q.data && (
					<div className="mt-3 flex items-center gap-2 text-xs text-ink-400">
						<Loader2 className="size-3.5 animate-spin" /> Descargando y hasheando ~29 MB de circuitos oficiales…
					</div>
				)}
			</div>
		</Card>
	);
}
