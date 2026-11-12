import { type Hex, keccak256, toHex } from "viem";

/**
 * Metadatos de factura del lado del pagador (sólo en SU navegador).
 * On-chain sólo va `refFactura = keccak256(numero | salt)`: el salt evita que alguien
 * adivine la factura (y su monto) por fuerza bruta.
 */
export type FacturaLocal = { numero: string; salt: Hex; monto?: string; concepto?: string };

const key = (chainId: number, vault: string) => `trasluz:factura:${chainId}:${vault.toLowerCase()}`;

export const refFactura = (numero: string, salt: Hex) => keccak256(toHex(`${numero.trim()}|${salt}`));

export const newSalt = (): Hex => {
	const b = new Uint8Array(32);
	crypto.getRandomValues(b);
	return toHex(b);
};

export const saveFactura = (chainId: number, vault: string, f: FacturaLocal) =>
	localStorage.setItem(key(chainId, vault), JSON.stringify(f));

export const loadFactura = (chainId: number, vault: string): FacturaLocal | null => {
	const raw = localStorage.getItem(key(chainId, vault));
	return raw ? (JSON.parse(raw) as FacturaLocal) : null;
};
