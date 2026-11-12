import { EyeOff, LockKeyhole, Unlock } from "lucide-react";
import { useEffect, useRef } from "react";
import { fmtUSDC } from "../lib/format";
import { DecryptText } from "./fx";

const HEX = "0123456789abcdef";

/**
 * Un único ticker para todos los ciphertext de la página: escribe directo en el DOM
 * (sin re-render de React), sólo para los visibles en pantalla y nunca con la pestaña oculta.
 */
const visible = new Set<HTMLElement>();
let timer: ReturnType<typeof setInterval> | undefined;
const scramble = (el: HTMLElement) => {
	const s = el.dataset.v ?? "";
	let out = "";
	for (let i = 0; i < s.length; i++) out += Math.random() < 0.12 ? HEX[(HEX.indexOf(s[i]) + 1 + i) % 16] : s[i];
	el.dataset.v = out;
	el.textContent = `0x${out}…`;
};
const syncTimer = () => {
	const run = visible.size > 0 && document.visibilityState === "visible";
	if (run && !timer) timer = setInterval(() => visible.forEach(scramble), 140);
	if (!run && timer) {
		clearInterval(timer);
		timer = undefined;
	}
};
if (typeof document !== "undefined") document.addEventListener("visibilitychange", syncTimer);
const io =
	typeof IntersectionObserver !== "undefined"
		? new IntersectionObserver((entries) => {
				for (const e of entries) e.isIntersecting ? visible.add(e.target as HTMLElement) : visible.delete(e.target as HTMLElement);
				syncTimer();
			})
		: null;

/** Ciphertext "vivo": así ve el monto cualquiera que no tenga la clave. */
export function Cipher({ value, len = 18, animate = true, className = "" }: { value?: bigint | string; len?: number; animate?: boolean; className?: string }) {
	const base = (typeof value === "bigint" ? value.toString(16) : (value ?? "").replace(/^0x/, "")).padEnd(len, "0").slice(0, len);
	const ref = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el || !animate || !io || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		el.dataset.v = base;
		io.observe(el);
		return () => {
			io.unobserve(el);
			visible.delete(el);
			syncTimer();
		};
	}, [animate, base]);
	return (
		<span className={`inline-flex items-center gap-1.5 ${className}`}>
			<LockKeyhole className="size-3.5 text-cipher-400/80" />
			<span ref={ref} className="cipher-text text-[12.5px]">
				0x{base}…
			</span>
		</span>
	);
}

/** Monto: verde si está descifrado localmente, ciphertext si no. */
export function Amount({ value, hidden, size = "md" }: { value?: bigint | null; hidden?: boolean; size?: "md" | "lg" | "xl" }) {
	const cls = size === "xl" ? "text-[34px]" : size === "lg" ? "text-2xl" : "text-sm";
	if (hidden || value === undefined || value === null) {
		return (
			<span className={`inline-flex items-center gap-2 ${cls}`}>
				<EyeOff className={size === "md" ? "size-3.5 text-ink-400" : "size-5 text-ink-400"} />
				<span className="cipher-text tracking-widest">••••••</span>
			</span>
		);
	}
	return (
		<span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${cls}`}>
			{size !== "md" && <Unlock className="size-4 text-clear-400" />}
			<DecryptText className="clear-text" text={fmtUSDC(value, { symbol: false })} />
			<span className="text-[0.55em] font-medium text-ink-400">USDC</span>
		</span>
	);
}
