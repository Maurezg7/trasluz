import { Info, X } from "lucide-react";
import { useEffect, useState } from "react";

/** Toasts mínimos (reemplaza `sonner`, ~67 KB): una cola en memoria y un único componente. */
type T = { id: number; title: string; description?: string };
let seq = 0;
const listeners = new Set<(t: T) => void>();

export const toast = {
	info: (title: string, opts: { description?: string } = {}) => {
		const t = { id: ++seq, title, description: opts.description };
		for (const l of listeners) l(t);
	},
};

export function Toaster() {
	const [items, setItems] = useState<T[]>([]);
	useEffect(() => {
		const add = (t: T) => {
			setItems((x) => [...x.slice(-2), t]);
			setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 5000);
		};
		listeners.add(add);
		return () => {
			listeners.delete(add);
		};
	}, []);
	return (
		<div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2" aria-live="polite">
			{items.map((t) => (
				<div key={t.id} className="card pointer-events-auto flex items-start gap-3 p-4 animate-fade-up">
					<Info className="mt-0.5 size-4 shrink-0 text-ava-400" />
					<div className="flex-1">
						<div className="text-sm font-medium text-white">{t.title}</div>
						{t.description && <div className="mt-0.5 text-xs text-ink-400">{t.description}</div>}
					</div>
					<button type="button" aria-label="Cerrar" className="text-ink-400 hover:text-white" onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))}>
						<X className="size-4" />
					</button>
				</div>
			))}
		</div>
	);
}
