import { useEffect, useRef } from "react";

const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Ejecuta `lock` tras `idleMs` sin actividad, o si la pestaña queda oculta más de `hiddenMs`.
 * Reduce la ventana de exposición de claves que viven en memoria.
 */
export function useAutoLock(active: boolean, lock: () => void, { idleMs = 15 * 60_000, hiddenMs = 5 * 60_000 } = {}) {
	const lockRef = useRef(lock);
	lockRef.current = lock;

	useEffect(() => {
		if (!active) return;
		let idle = setTimeout(() => lockRef.current(), idleMs);
		let hidden: ReturnType<typeof setTimeout> | undefined;
		let last = 0;
		const bump = () => {
			const now = Date.now();
			if (now - last < 1000) return;
			last = now;
			clearTimeout(idle);
			idle = setTimeout(() => lockRef.current(), idleMs);
		};
		const vis = () => {
			clearTimeout(hidden);
			if (document.visibilityState === "hidden") hidden = setTimeout(() => lockRef.current(), hiddenMs);
		};
		for (const ev of ACTIVITY) window.addEventListener(ev, bump, { passive: true });
		document.addEventListener("visibilitychange", vis);
		return () => {
			clearTimeout(idle);
			clearTimeout(hidden);
			for (const ev of ACTIVITY) window.removeEventListener(ev, bump);
			document.removeEventListener("visibilitychange", vis);
		};
	}, [active, idleMs, hiddenMs]);
}
