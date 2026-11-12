import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Cipher } from "./Cipher";
import { DecryptText, usePauseOffscreen, usePointerVars } from "./fx";
import { LogoMark } from "./Logo";

const ROWS = [
	["Acme S.A.", "Insumos del Sur", "19a6380ff3c72d1a7a0194e9b2"],
	["Acme S.A.", "Logística Andina", "23042065ba8b0db7123d402aad"],
	["Vault #41", "Metalúrgica Río", "0e86609c83f891af952a66051"],
];

/**
 * Escena 3D en CSS puro (perspective + preserve-3d): tres capas apiladas y un haz de luz
 * que las atraviesa.
 *  abajo  → lo que ve el explorer (ciphertext)
 *  medio  → el isotipo de Trasluz
 *  arriba → lo que ve el auditor (descifrado)
 * La escena sigue al puntero; sin WebGL, sin librerías, ~0 KB extra.
 */
export function Hero3D() {
	const ref = usePointerVars<HTMLDivElement>(14, "window");
	const pauseRef = usePauseOffscreen<HTMLDivElement>();
	return (
		<div ref={pauseRef}>
		<div ref={ref} className="scene3d relative mx-auto aspect-[1/0.9] w-full max-w-[360px] sm:aspect-square sm:max-w-[520px]" aria-hidden="true">
			<div className="stage3d">
				{/* sombra/halo del piso */}
				<div className="layer3d" style={{ transform: "translateZ(-60px)" }}>
					<div className="absolute inset-[2%] rounded-full bg-[radial-gradient(closest-side,rgb(232_65_66/0.28),transparent)]" />
				</div>

				{/* Capa pública */}
				<div className="layer3d float-a" style={{ transform: "translateZ(0px)" }}>
					<div className="glass absolute inset-x-[4%] top-[42%] p-4">
						<div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-400">
							<EyeOff className="size-3.5" /> Snowtrace · público
						</div>
						<div className="mt-3 space-y-2">
							{ROWS.map(([a, b, c]) => (
								<div key={c} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-[11.5px]">
									<span className="truncate text-ink-300">
										{a} → {b}
									</span>
									<Cipher value={c} len={12} />
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Diafragma */}
				<div className="layer3d float-b" style={{ transform: "translateZ(90px)" }}>
					<div className="absolute top-[20%] left-[30%] -translate-x-1/2">
						<div className="relative">
							<div className="absolute inset-[-45%] rounded-full bg-[radial-gradient(closest-side,rgb(16_185_129/0.28),transparent)]" />
							<div className="relative grid size-28 place-items-center rounded-[1.75rem] border border-white/10 bg-ink-900/85 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.08)]">
								<LogoMark size={88} open />
							</div>
						</div>
					</div>
				</div>

				{/* Haz de luz que atraviesa las capas: "al trasluz" */}
				<div className="layer3d" style={{ transform: "translateZ(70px)" }}>
					<div className="light-shaft" />
				</div>

				{/* Capa auditor */}
				<div className="layer3d float-c" style={{ transform: "translateZ(140px)" }}>
					<div className="glass glass-clear absolute top-[12%] right-[6%] w-[56%] p-4">
						<div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-clear-400">
							<Eye className="size-3.5" /> Auditor · viewing key
						</div>
						<div className="mt-2 clear-text text-[26px] font-semibold leading-none">
							<DecryptText text="18.750,25" duration={1400} />
							<span className="ml-1.5 text-xs text-ink-400">USDC</span>
						</div>
						<div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-300">
							<LockKeyhole className="size-3 text-clear-400" /> fondeado = liberado · concilia ✓
						</div>
					</div>
				</div>

				{/* partículas cifradas */}
				{["a3f9", "0x7e", "c41d", "9b2e", "ff03"].map((t, i) => (
					<div key={t} className="layer3d" style={{ transform: `translateZ(${40 + i * 30}px)` }}>
						<span
							className="particle cipher-text absolute hidden text-[10px] sm:block"
							style={{ left: `${8 + ((i * 19) % 80)}%`, top: `${10 + ((i * 23) % 70)}%`, animationDelay: `${i * -1.3}s` }}
						>
							{t}
						</span>
					</div>
				))}
			</div>
		</div>
		</div>
	);
}
