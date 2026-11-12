import { type HTMLAttributes, type ReactNode, useEffect, useRef } from "react";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

/**
 * Seguimiento del puntero → variables CSS (--rx, --ry, --mx, --my) en el elemento.
 * Sin estado de React: un solo rAF por frame, sólo transforms (GPU). Se desactiva con
 * prefers-reduced-motion o en pantallas táctiles.
 */
export function usePointerVars<T extends HTMLElement>(max = 8, target: "self" | "window" = "self") {
	const ref = useRef<T>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el || reducedMotion() || !finePointer()) return;
		let raf = 0;
		let px = 0.5;
		let py = 0.5;
		const apply = () => {
			raf = 0;
			el.style.setProperty("--rx", `${((0.5 - py) * max).toFixed(2)}deg`);
			el.style.setProperty("--ry", `${((px - 0.5) * max).toFixed(2)}deg`);
			el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
			el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
		};
		const move = (e: PointerEvent) => {
			const r = target === "window" ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } : el.getBoundingClientRect();
			px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
			py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
			if (!raf) raf = requestAnimationFrame(apply);
		};
		const leave = () => {
			px = 0.5;
			py = 0.5;
			if (!raf) raf = requestAnimationFrame(apply);
		};
		const src: HTMLElement | Window = target === "window" ? window : el;
		src.addEventListener("pointermove", move as EventListener, { passive: true });
		el.addEventListener("pointerleave", leave);
		return () => {
			src.removeEventListener("pointermove", move as EventListener);
			el.removeEventListener("pointerleave", leave);
			cancelAnimationFrame(raf);
		};
	}, [max, target]);
	return ref;
}

/** Tarjeta con inclinación 3D + reflejo que sigue al puntero. */
export function Tilt({ children, max = 7, className = "", ...rest }: { children: ReactNode; max?: number; className?: string } & HTMLAttributes<HTMLDivElement>) {
	const ref = usePointerVars<HTMLDivElement>(max);
	return (
		<div ref={ref} {...rest} className={`tilt ${className}`}>
			<div className="tilt-inner">
				{children}
				<div className="tilt-glare" aria-hidden="true" />
			</div>
		</div>
	);
}

const HEX = "0123456789abcdef";

/**
 * "Descifrado" animado: el texto arranca como hex aleatorio y se resuelve carácter a carácter.
 * Es puramente visual (el valor real ya está descifrado localmente).
 */
export function DecryptText({ text, duration = 750, className = "" }: { text: string; duration?: number; className?: string }) {
	// Escribe en el DOM por rAF (sin setState por frame): N montos animando = 0 re-renders.
	const ref = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (reducedMotion()) {
			el.textContent = text;
			return;
		}
		let raf = 0;
		const start = performance.now();
		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / duration);
			const reveal = Math.floor(t * text.length);
			let out = "";
			for (let i = 0; i < text.length; i++) out += i < reveal || text[i] < "0" || text[i] > "9" ? text[i] : HEX[(Math.random() * 16) | 0];
			el.textContent = out;
			if (t < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [text, duration]);
	return (
		<span ref={ref} className={className} aria-label={text}>
			{text}
		</span>
	);
}

/** Pausa las animaciones CSS de un elemento cuando sale de pantalla o se oculta la pestaña. */
export function usePauseOffscreen<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		let onScreen = true;
		const apply = () => el.classList.toggle("paused", !onScreen || document.visibilityState !== "visible");
		const io = new IntersectionObserver(([e]) => {
			onScreen = e.isIntersecting;
			apply();
		});
		io.observe(el);
		document.addEventListener("visibilitychange", apply);
		return () => {
			io.disconnect();
			document.removeEventListener("visibilitychange", apply);
		};
	}, []);
	return ref;
}

/** Fondo ambiental: dos auroras desenfocadas que se mueven lento (un solo layer compuesto). */
export function Ambient() {
	const ref = usePauseOffscreen<HTMLDivElement>();
	return (
		<div ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
			<div className="aurora aurora-a" />
			<div className="aurora aurora-b" />
		</div>
	);
}
