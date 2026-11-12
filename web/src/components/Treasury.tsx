import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, Droplets, Eye, EyeOff, Landmark, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useCtx, useEntity } from "../hooks/useCtx";
import { deposit, faucet, readDecryptedBalance, withdraw } from "../lib/eerc";
import { fmtUSDC, parseUSDC } from "../lib/format";
import { useAction } from "../state/action";
import { useKeys } from "../state/keys";
import { Amount, Cipher } from "./Cipher";
import { Button, Card } from "./ui";

export const usePrivateBalance = () => {
	const { ctx, d, address } = useCtx();
	const { keyPair } = useKeys();
	return useQuery({
		queryKey: ["eerc-balance", d?.chainId, address, keyPair?.publicKey[0].toString()],
		enabled: !!ctx && !!address && !!keyPair,
		refetchInterval: 10_000,
		queryFn: () => readDecryptedBalance(ctx!, address!, keyPair!),
	});
};

/** Tesorería: USDC público ↔ saldo eERC cifrado (converter mode). */
export function Treasury({ title = "Tesorería", allowDeposit = true }: { title?: string; allowDeposit?: boolean }) {
	const { ctx, address } = useCtx();
	const ent = useEntity(address);
	const { keyPair } = useKeys();
	const bal = usePrivateBalance();
	const { run } = useAction();
	const [mode, setMode] = useState<"deposit" | "withdraw" | null>(null);
	const [amount, setAmount] = useState("");
	const [reveal, setReveal] = useState(true);

	const submit = async () => {
		if (!ctx || !keyPair || !mode) return;
		let v: bigint;
		try {
			v = parseUSDC(amount);
		} catch (e) {
			return run("Monto inválido", async () => {
				throw e;
			});
		}
		const ok =
			mode === "deposit"
				? await run("Depositar USDC → eERC", (s) => deposit(ctx, keyPair, v, s), `Depositaste ${fmtUSDC(v)}. A partir de acá tus movimientos son confidenciales.`)
				: await run("Retirar eERC → USDC", (s) => withdraw(ctx, keyPair, v, s), `Retiraste ${fmtUSDC(v)} a USDC público.`);
		if (ok) {
			setAmount("");
			setMode(null);
		}
	};

	return (
		<Card className="relative overflow-hidden">
			<div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-[radial-gradient(closest-side,rgb(232_65_66/0.14),transparent)]" />
			<div className="relative grid gap-px bg-white/[0.05] md:grid-cols-2">
				<div className="bg-ink-850 p-6">
					<div className="flex items-center justify-between">
						<span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-400">
							<ShieldCheck className="size-3.5 text-clear-400" /> {title} confidencial · eERC
						</span>
						<button type="button" onClick={() => setReveal((r) => !r)} className="text-ink-400 hover:text-white" title={reveal ? "Ocultar" : "Mostrar"}>
							{reveal ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
						</button>
					</div>
					<div className="mt-4 min-h-[44px]">
						{bal.data ? <Amount value={bal.data.balance} hidden={!reveal} size="xl" /> : <span className="text-ink-400">Descifrando…</span>}
					</div>
					<div className="mt-3 flex items-center gap-2 text-xs text-ink-400">
						On-chain: {bal.data ? <Cipher value={bal.data.encrypted[2]} len={22} /> : "…"}
					</div>
					{bal.data && !bal.data.consistent && <div className="mt-2 text-xs text-amber-300">Los PCT no coinciden con el ciphertext ElGamal.</div>}
				</div>
				<div className="bg-ink-850 p-6">
					<div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-400">
						<Landmark className="size-3.5" /> USDC público (ERC-20)
					</div>
					<div className="mt-4 text-[34px] font-semibold tracking-tight text-white">
						{ent.data ? fmtUSDC(ent.data.usdc, { symbol: false }) : "…"}
						<span className="ml-2 text-lg font-medium text-ink-400">USDC</span>
					</div>
					<div className="mt-3 text-xs text-ink-400">Depósitos y retiros son públicos: son la rampa de entrada/salida.</div>
				</div>
			</div>
			<div className="relative flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-6 py-4">
				{allowDeposit && (
					<Button size="sm" variant={mode === "deposit" ? "primary" : "secondary"} icon={<ArrowDownToLine className="size-3.5" />} onClick={() => setMode(mode === "deposit" ? null : "deposit")}>
						Depositar
					</Button>
				)}
				<Button size="sm" variant={mode === "withdraw" ? "primary" : "secondary"} icon={<ArrowUpFromLine className="size-3.5" />} onClick={() => setMode(mode === "withdraw" ? null : "withdraw")}>
					Retirar
				</Button>
				<Button size="sm" variant="ghost" icon={<Droplets className="size-3.5" />} onClick={() => ctx && run("Faucet de USDC de prueba", () => faucet(ctx), "Recibiste 100.000 USDC de prueba.")}>
					Faucet USDC
				</Button>
				{mode && (
					<form
						className="ml-auto flex w-full items-center gap-2 sm:w-auto"
						onSubmit={(e) => {
							e.preventDefault();
							submit();
						}}
					>
						<input autoFocus className="input h-9 sm:w-48" placeholder="Monto en USDC" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
						<Button size="sm" type="submit" disabled={!amount}>
							{mode === "deposit" ? "Depositar" : "Retirar"}
						</Button>
					</form>
				)}
			</div>
		</Card>
	);
}
