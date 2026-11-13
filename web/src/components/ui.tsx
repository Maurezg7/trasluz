import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { type ButtonHTMLAttributes, type ReactNode, useState } from "react";
import { useDeployment } from "../hooks/useCtx";
import { Tilt } from "./fx";
import { explorerAddr, explorerTx, short } from "../lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const VARIANTS: Record<Variant, string> = {
	primary:
		"bg-gradient-to-b from-ava-400 to-ava-600 text-white shadow-[0_8px_24px_-8px_rgb(232_65_66/0.6),inset_0_1px_0_rgb(255_255_255/0.25)] hover:brightness-110",
	secondary: "bg-white/[0.06] text-white border border-white/10 hover:bg-white/[0.1]",
	ghost: "text-ink-300 hover:text-white hover:bg-white/[0.05]",
	danger: "bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20",
	success:
		"bg-gradient-to-b from-clear-400 to-clear-500 text-ink-950 shadow-[0_8px_24px_-8px_rgb(16_185_129/0.55)] hover:brightness-110",
};

export function Button({
	variant = "primary",
	size = "md",
	loading,
	icon,
	children,
	className = "",
	...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: Variant;
	size?: "sm" | "md" | "lg";
	loading?: boolean;
	icon?: ReactNode;
}) {
	const sz = size === "sm" ? "h-8 px-3 text-xs" : size === "lg" ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-sm";
	return (
		<button
			{...rest}
			disabled={rest.disabled || loading}
			className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 ${variant === "primary" || variant === "success" ? "btn-shine" : ""} ${sz} ${VARIANTS[variant]} ${className}`}
		>
			{loading ? <Loader2 className="size-4 animate-spin" /> : icon}
			{children}
		</button>
	);
}

export function Card({ children, className = "", ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div {...rest} className={`card ${className}`}>
			{children}
		</div>
	);
}

export function CardHeader({ title, subtitle, icon, action }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
	return (
		<div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
			<div className="flex items-start gap-3">
				{icon && <div className="mt-0.5 grid size-9 place-items-center rounded-xl bg-white/[0.04] text-ava-400 ring-1 ring-white/[0.06]">{icon}</div>}
				<div>
					<h3 className="text-[15px] font-semibold text-white">{title}</h3>
					{subtitle && <p className="mt-0.5 text-[13px] text-ink-400">{subtitle}</p>}
				</div>
			</div>
			{action}
		</div>
	);
}

const TONES = {
	neutral: "bg-white/[0.06] text-ink-200 ring-white/10",
	red: "bg-ava-500/10 text-ava-300 ring-ava-500/25",
	green: "bg-clear-500/10 text-clear-400 ring-clear-500/25",
	amber: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
	blue: "bg-sky-500/10 text-sky-300 ring-sky-500/25",
	violet: "bg-violet-500/10 text-violet-300 ring-violet-500/25",
};
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children, dot, className = "" }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
	return (
		<span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}>
			{dot && <span className="size-1.5 rounded-full bg-current" />}
			{children}
		</span>
	);
}

export function Stat({ label, value, hint, icon, tone }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "red" | "green" }) {
	return (
		<Tilt className="h-full">
		<Card className="h-full p-5">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium uppercase tracking-wider text-ink-400">{label}</span>
				{icon && <span className={tone === "green" ? "text-clear-400" : "text-ava-400"}>{icon}</span>}
			</div>
			<div className="lift mt-3 text-2xl font-semibold tracking-tight text-white">{value}</div>
			{hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
		</Card>
		</Tilt>
	);
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
	return (
		<div className="flex flex-col items-center justify-center px-6 py-14 text-center">
			<div className="grid size-12 place-items-center rounded-2xl bg-white/[0.04] text-ink-400 ring-1 ring-white/[0.06]">{icon}</div>
			<div className="mt-4 text-sm font-medium text-white">{title}</div>
			{children && <div className="mt-1 max-w-sm text-[13px] text-ink-400">{children}</div>}
		</div>
	);
}

export function CopyButton({ value, className = "" }: { value: string; className?: string }) {
	const [ok, setOk] = useState(false);
	return (
		<button
			type="button"
			title="Copiar"
			onClick={() => {
				navigator.clipboard.writeText(value);
				setOk(true);
				setTimeout(() => setOk(false), 1200);
			}}
			className={`text-ink-400 transition hover:text-white ${className}`}
		>
			{ok ? <Check className="size-3.5 text-clear-400" /> : <Copy className="size-3.5" />}
		</button>
	);
}

/** Dirección con avatar determinístico, copia y link al explorer. */
export function Addr({ a, label, n = 4 }: { a?: string; label?: string; n?: number }) {
	const d = useDeployment();
	if (!a) return <span className="text-ink-400">—</span>;
	const url = d ? explorerAddr(d.explorer, a as `0x${string}`) : null;
	const hue = Number.parseInt(a.slice(2, 8), 16) % 360;
	return (
		<span className="inline-flex items-center gap-2">
			<span
				className="size-4 shrink-0 rounded-full ring-1 ring-white/20"
				style={{ background: `conic-gradient(from ${hue}deg, hsl(${hue} 70% 55%), hsl(${(hue + 120) % 360} 70% 45%), hsl(${hue} 70% 55%))` }}
			/>
			<span className="whitespace-nowrap font-mono text-[12.5px] text-ink-200">{label ?? short(a, n)}</span>
			<CopyButton value={a} />
			{url && (
				<a href={url} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-white">
					<ExternalLink className="size-3.5" />
				</a>
			)}
		</span>
	);
}

export function TxLink({ hash, children }: { hash: string; children?: ReactNode }) {
	const d = useDeployment();
	const url = d ? explorerTx(d.explorer, hash) : null;
	const content = children ?? <span className="font-mono">{short(hash, 6)}</span>;
	return url ? (
		<a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ava-300 hover:text-ava-400 hover:underline">
			{content}
			<ExternalLink className="size-3" />
		</a>
	) : (
		<span className="inline-flex items-center gap-1 text-ink-300">
			{content}
			<CopyButton value={hash} />
		</span>
	);
}

export function Skeleton({ className = "" }: { className?: string }) {
	return <div className={`shimmer rounded-lg bg-white/[0.04] ${className}`} />;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
	return (
		<label className="block">
			<span className="label">{label}</span>
			{children}
			{hint && <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>}
		</label>
	);
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
	return (
		<div className="mb-8 animate-fade-up">
			<div className="text-xs font-semibold uppercase tracking-[0.2em] text-ava-400">{eyebrow}</div>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-[34px]">{title}</h1>
			{children && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-300">{children}</p>}
		</div>
	);
}
