import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import { type ReactNode, createContext, useCallback, useContext, useState } from "react";
import { LogoMark } from "../components/Logo";
import { Button, TxLink } from "../components/ui";
import { errMsg } from "../lib/format";

type Step = { msg: string; at: number };
type Run = {
	title: string;
	steps: Step[];
	status: "running" | "done" | "error";
	error?: string;
	hash?: string;
	success?: ReactNode;
};
type Fn = (step: (m: string) => void) => Promise<string | void | { hash: string }>;
type ActionApi = { run: (title: string, fn: Fn, success?: ReactNode) => Promise<boolean>; busy: boolean };

const Ctx = createContext<ActionApi | null>(null);

/** Diálogo de progreso para operaciones con prueba ZK + firma + confirmación on-chain. */
export function ActionProvider({ children }: { children: ReactNode }) {
	const qc = useQueryClient();
	const [r, setR] = useState<Run | null>(null);

	const run = useCallback<ActionApi["run"]>(
		async (title, fn, success) => {
			setR({ title, steps: [], status: "running", success });
			const step = (msg: string) => setR((x) => (x ? { ...x, steps: [...x.steps, { msg, at: Date.now() }] } : x));
			try {
				const out = await fn(step);
				const hash = typeof out === "string" ? out : out && "hash" in out ? out.hash : undefined;
				setR((x) => (x ? { ...x, status: "done", hash } : x));
				return true;
			} catch (e) {
				setR((x) => (x ? { ...x, status: "error", error: errMsg(e) } : x));
				return false;
			} finally {
				qc.invalidateQueries();
			}
		},
		[qc],
	);

	const proving = r?.status === "running" && r.steps.at(-1)?.msg.includes("prueba");

	return (
		<Ctx.Provider value={{ run, busy: r?.status === "running" }}>
			{children}
			{r && (
				<div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4 backdrop-blur-md animate-fade-up">
					<div className="card w-full max-w-md overflow-hidden">
						<div className="relative flex items-center gap-4 border-b border-white/[0.06] px-6 py-5">
							<LogoMark size={40} open={r.status === "done"} scanning={r.status === "running"} />
							<div className="flex-1">
								<div className="text-[15px] font-semibold text-white">{r.title}</div>
								<div className="text-xs text-ink-400">
									{r.status === "running" ? (proving ? "Generando prueba de conocimiento cero en tu navegador" : "En curso…") : r.status === "done" ? "Confirmado on-chain" : "No se pudo completar"}
								</div>
							</div>
							{r.status !== "running" && (
								<button type="button" onClick={() => setR(null)} className="text-ink-400 hover:text-white">
									<X className="size-5" />
								</button>
							)}
						</div>
						<div className="space-y-3 px-6 py-5">
							{r.steps.map((s, i) => {
								const last = i === r.steps.length - 1;
								const active = last && r.status === "running";
								return (
									<div key={`${s.at}-${i}`} className="flex items-start gap-3 text-sm animate-fade-up">
										{active ? (
											<Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-ava-400" />
										) : last && r.status === "error" ? (
											<AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
										) : (
											<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-clear-400" />
										)}
										<span className={active ? "text-white" : "text-ink-300"}>{s.msg}</span>
									</div>
								);
							})}
							{r.steps.length === 0 && r.status === "running" && (
								<div className="flex items-center gap-3 text-sm text-ink-300">
									<Loader2 className="size-4 animate-spin text-ava-400" /> Preparando…
								</div>
							)}
							{proving && (
								<div className="rounded-xl border border-white/[0.06] bg-ink-900/70 p-3 text-xs leading-relaxed text-ink-400">
									<ShieldCheck className="mr-1.5 inline size-3.5 text-clear-400" />
									El monto se cifra y se prueba localmente con los circuitos oficiales de eERC (Groth16). Tu clave nunca sale del navegador.
								</div>
							)}
							{r.status === "error" && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{r.error}</div>}
							{r.status === "done" && (
								<div className="rounded-xl border border-clear-500/20 bg-clear-500/10 p-3 text-sm text-clear-400">
									{r.success ?? "Listo."}
									{r.hash && (
										<div className="mt-1.5 text-xs">
											<TxLink hash={r.hash}>Ver transacción</TxLink>
										</div>
									)}
								</div>
							)}
						</div>
						{r.status !== "running" && (
							<div className="flex justify-end border-t border-white/[0.06] px-6 py-4">
								<Button variant="secondary" size="sm" onClick={() => setR(null)}>
									Cerrar
								</Button>
							</div>
						)}
					</div>
				</div>
			)}
		</Ctx.Provider>
	);
}

export const useAction = () => {
	const c = useContext(Ctx);
	if (!c) throw new Error("ActionProvider faltante");
	return c;
};
