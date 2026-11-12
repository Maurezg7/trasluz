import { useId } from "react";

const EASE = "cubic-bezier(.2,.8,.2,1)";

/**
 * Isotipo de Trasluz: dos paneles opacos (rojo Avalanche) y, entre ellos, una rendija por la
 * que pasa la luz (verde). Lo cifrado queda tapado; sólo se ve lo que deja pasar la ventana.
 *  - `open`: los paneles se abren y la luz crece (ventana del auditor abierta).
 *  - `scanning`: la luz late (mientras se genera una prueba ZK).
 */
export function LogoMark({ size = 36, open = false, scanning = false, tile = false, className = "" }: { size?: number; open?: boolean; scanning?: boolean; tile?: boolean; className?: string }) {
	// ids únicos por instancia: si se repiten, url(#id) resuelve al primero del documento y,
	// si está en un subárbol oculto (sidebar en mobile), el logo queda sin relleno.
	const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
	const id = (n: string) => `tl-${n}-${uid}`;
	const shift = open ? 3.5 : 0;
	const panel = (x: number, dir: -1 | 1) => (
		<rect
			x={x}
			y="14"
			width="16"
			height="36"
			rx="5"
			fill={`url(#${id("r")})`}
			style={{ transform: `translateX(${dir * shift}px)`, transition: `transform .6s ${EASE}` }}
		/>
	);
	return (
		<svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
			<defs>
				<linearGradient id={id("r")} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="#ff5a5f" />
					<stop offset="1" stopColor="#b3141c" />
				</linearGradient>
				<linearGradient id={id("g")} x1="0" y1="0" x2="1" y2="0">
					<stop offset="0" stopColor="#34d399" stopOpacity="0" />
					<stop offset=".5" stopColor="#34d399" stopOpacity=".5" />
					<stop offset="1" stopColor="#34d399" stopOpacity="0" />
				</linearGradient>
				<linearGradient id={id("s")} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="#34d399" stopOpacity="0" />
					<stop offset=".18" stopColor="#6ee7b7" />
					<stop offset=".82" stopColor="#6ee7b7" />
					<stop offset="1" stopColor="#34d399" stopOpacity="0" />
				</linearGradient>
			</defs>
			{tile && <rect width="64" height="64" rx="16" fill="#0e0e13" />}
			<rect
				x="21"
				y="9"
				width="22"
				height="46"
				fill={`url(#${id("g")})`}
				style={{ transformOrigin: "32px 32px", transform: `scaleX(${open ? 1.6 : 1})`, transition: `transform .6s ${EASE}` }}
			>
				{scanning && <animate attributeName="opacity" values="1;.35;1" dur="1.4s" repeatCount="indefinite" />}
			</rect>
			{panel(13, -1)}
			{panel(35, 1)}
			<rect
				x="30.5"
				y="8"
				width="3"
				height="48"
				rx="1.5"
				fill={`url(#${id("s")})`}
				style={{ transformOrigin: "32px 32px", transform: `scaleX(${open ? 1.8 : 1})`, transition: `transform .6s ${EASE}` }}
			>
				{scanning && <animate attributeName="opacity" values="1;.5;1" dur="1.4s" repeatCount="indefinite" />}
			</rect>
		</svg>
	);
}

export function Logo({ compact = false }: { compact?: boolean }) {
	return (
		<div className="group flex items-center gap-3">
			<div className="relative">
				<div className="absolute -inset-3 rounded-full bg-[radial-gradient(closest-side,rgb(52_211_153/0.25),transparent)] opacity-60 transition group-hover:opacity-100" />
				<LogoMark size={38} open={false} className="relative transition-transform duration-500 group-hover:scale-105" />
			</div>
			{!compact && (
				<div className="leading-none">
					<div className="text-[19px] font-semibold tracking-tight text-white">
						Trasluz<span className="text-clear-400">.</span>
					</div>
					<div className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.18em] text-ink-400">Liquidación confidencial</div>
				</div>
			)}
		</div>
	);
}
