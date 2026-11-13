import { useQuery } from "@tanstack/react-query";
import { Ban, FilePlus2, HandCoins, Inbox, Send, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { Amount } from "../components/Cipher";
import { Gate } from "../components/Gate";
import { ObligacionCard } from "../components/ObligacionCard";
import { Treasury, usePrivateBalance } from "../components/Treasury";
import { Addr, Button, Card, CardHeader, Empty, Field, SectionTitle, Skeleton } from "../components/ui";
import { useCtx, useEntidades, useObligaciones } from "../hooks/useCtx";
import type { Obligacion } from "../lib/chain";
import { cancelar, crearObligacion, fondear, liberar, readDecryptedBalance, reembolsar, vaultKeyFor } from "../lib/eerc";
import { fmtUSDC, parseUSDC, sameAddr, short } from "../lib/format";
import { loadFactura, newSalt, refFactura, saveFactura } from "../lib/local";
import { useAction } from "../state/action";
import { useKeys } from "../state/keys";

const nuevoNumero = () => `FAC-A-0001-${String(Math.floor(Math.random() * 90000) + 10000).padStart(8, "0")}`;

function NuevaObligacion() {
	const { ctx, d, address } = useCtx();
	const { keyPair } = useKeys();
	const entidades = useEntidades();
	const bal = usePrivateBalance();
	const { run } = useAction();
	const [proveedor, setProveedor] = useState("");
	const [numero, setNumero] = useState(nuevoNumero);
	const [concepto, setConcepto] = useState("");
	const [monto, setMonto] = useState("");

	const opciones = (entidades.data ?? []).filter((a) => !sameAddr(a, address));
	let montoErr: string | null = null;
	let montoV = 0n;
	if (monto) {
		try {
			montoV = parseUSDC(monto);
			if (bal.data && montoV > bal.data.balance) montoErr = "Supera tu saldo confidencial: depositá primero.";
		} catch (e) {
			montoErr = (e as Error).message;
		}
	}
	const valid = isAddress(proveedor) && numero.trim() && montoV > 0n && !montoErr;

	const submit = () =>
		ctx &&
		keyPair &&
		d &&
		run(
			"Nueva obligación confidencial",
			async (step) => {
				const salt = newSalt();
				const { id, vault } = await crearObligacion(ctx, keyPair, proveedor as Address, refFactura(numero, salt), step);
				saveFactura(d.chainId, vault, { numero: numero.trim(), salt, monto, concepto });
				return fondear(ctx, keyPair, id, vault, montoV, step);
			},
			<>
				Obligación creada y fondeada por <b>{fmtUSDC(montoV)}</b>. En el explorer, el monto es ciphertext.
			</>,
		).then((ok) => {
			if (!ok) return;
			setMonto("");
			setConcepto("");
			setNumero(nuevoNumero());
		});

	return (
		<Card>
			<CardHeader icon={<FilePlus2 className="size-4" />} title="Nueva obligación" subtitle="Pago contra entrega con escrow confidencial" />
			<div className="space-y-4 p-5">
				<Field label="Proveedor (entidad KYC)">
					{opciones.length ? (
						<select className="input" value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
							<option value="">Elegí un proveedor…</option>
							{opciones.map((a) => (
								<option key={a} value={a}>
									{short(a, 6)}
								</option>
							))}
						</select>
					) : (
						<input className="input font-mono" placeholder="0x…" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
					)}
				</Field>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field label="N° de factura" hint="Sólo su hash con salt va on-chain">
						<input className="input font-mono" value={numero} onChange={(e) => setNumero(e.target.value)} />
					</Field>
					<Field label="Monto (USDC)" hint={montoErr ? <span className="text-amber-300">{montoErr}</span> : "Se cifra en tu navegador"}>
						<input className="input" inputMode="decimal" placeholder="25.000,00" value={monto} onChange={(e) => setMonto(e.target.value)} />
					</Field>
				</div>
				<Field label="Concepto (privado, sólo local)">
					<input className="input" placeholder="Insumos — OC 4521" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
				</Field>
				<Button className="w-full" size="lg" disabled={!valid} icon={<Send className="size-4" />} onClick={submit}>
					Crear y fondear confidencialmente
				</Button>
				<p className="text-center text-[11.5px] text-ink-400">3 firmas: crear (con vault propio) · transferencia eERC al vault · fondear</p>
			</div>
		</Card>
	);
}

function MiObligacion({ o }: { o: Obligacion }) {
	const { ctx, d } = useCtx();
	const { keyPair } = useKeys();
	const { run } = useAction();
	const [manual, setManual] = useState("");
	const factura = d ? loadFactura(d.chainId, o.vault) : null;
	const vaultBal = useQuery({
		queryKey: ["vault-bal", d?.chainId, o.vault, o.estado],
		enabled: !!ctx && !!keyPair,
		queryFn: async () => readDecryptedBalance(ctx!, o.vault, await vaultKeyFor(keyPair!, o.vault)),
	});
	if (!ctx || !keyPair) return null;
	const enVault = vaultBal.data?.balance ?? 0n;
	const tryParse = (v?: string) => {
		try {
			return v ? parseUSDC(v) : null;
		} catch {
			return null;
		}
	};
	const local = tryParse(factura?.monto);
	const monto = enVault > 0n ? enVault : (local ?? tryParse(manual));

	const acciones = [];
	if (o.estado === "Creada") {
		// Sin registro local (otro navegador): el pagador ingresa el monto a fondear.
		if (!local && enVault === 0n) {
			acciones.push(
				<input key="m" className="input h-8 w-32 text-xs" inputMode="decimal" placeholder="Monto USDC" value={manual} onChange={(e) => setManual(e.target.value)} />,
			);
		}
		acciones.push(
			<Button key="f" size="sm" icon={<HandCoins className="size-3.5" />} disabled={!monto} onClick={() => monto && run("Fondear obligación", (s) => fondear(ctx, keyPair, o.id, o.vault, monto, s), "Obligación fondeada.")}>
				Fondear
			</Button>,
		);
	}
	if (o.estado === "Creada" || (o.estado === "Fondeada" && !o.entregaConfirmada)) {
		acciones.push(
			<Button key="c" size="sm" variant="ghost" icon={<Ban className="size-3.5" />} onClick={() => run("Cancelar obligación", () => cancelar(ctx, o.id), "Obligación cancelada. Podés reembolsar el escrow.")}>
				Cancelar
			</Button>,
		);
	}
	if (o.estado === "Fondeada" && o.entregaConfirmada) {
		acciones.push(
			<Button key="l" size="sm" variant="success" icon={<Send className="size-3.5" />} onClick={() => run("Liberar pago al proveedor", (s) => liberar(ctx, keyPair, o.id, o.vault, o.proveedor, s), "Pago liberado con una transferencia confidencial eERC.")}>
				Liberar pago
			</Button>,
		);
	}
	if (o.estado === "Cancelada" && enVault > 0n) {
		acciones.push(
			<Button key="r" size="sm" variant="secondary" icon={<Undo2 className="size-3.5" />} onClick={() => run("Reembolsar escrow", (s) => reembolsar(ctx, keyPair, o.id, o.vault, o.pagador, s), "El saldo del vault volvió a tu tesorería.")}>
				Reembolsar {fmtUSDC(enVault)}
			</Button>,
		);
	}
	return (
		<ObligacionCard
			o={o}
			contraparte={o.proveedor}
			contraparteLabel="Proveedor"
			factura={factura?.numero}
			highlight={o.estado === "Fondeada" && o.entregaConfirmada}
			monto={vaultBal.isLoading ? <Skeleton className="h-5 w-28" /> : <Amount value={monto} size="lg" />}
			actions={acciones}
		/>
	);
}

export default function Empresa() {
	const { address } = useCtx();
	const obs = useObligaciones();
	const mias = useMemo(() => (obs.data ?? []).filter((o) => sameAddr(o.pagador, address)), [obs.data, address]);
	return (
		<>
			<SectionTitle eyebrow="Empresa pagadora" title="Pagá a tus proveedores sin mostrarle tu flujo de caja al mercado">
				Creás la obligación, fondeás un escrow cifrado y liberás contra entrega. Ni tu competencia ni el explorer ven cuánto pagás ni a qué precio.
			</SectionTitle>
			<Gate role="empresa pagadora">
				<div className="space-y-6">
					<Treasury />
					<div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
						<div className="lg:sticky lg:top-24 lg:self-start">
							<NuevaObligacion />
						</div>
						<div className="min-w-0 space-y-4">
							<div className="flex items-center justify-between">
								<h2 className="text-sm font-semibold text-white">Mis obligaciones</h2>
								<span className="text-xs text-ink-400">{mias.length} en total</span>
							</div>
							{obs.isLoading && <Skeleton className="h-40" />}
							{!obs.isLoading && mias.length === 0 && (
								<Card>
									<Empty icon={<Inbox className="size-5" />} title="Todavía no creaste obligaciones">
										Elegí un proveedor habilitado, cargá la factura y el monto. <Addr a={address} /> será el pagador.
									</Empty>
								</Card>
							)}
							{mias.map((o) => (
								<MiObligacion key={o.id.toString()} o={o} />
							))}
						</div>
					</div>
				</div>
			</Gate>
		</>
	);
}
