/** Utilidades sin dependencias criptográficas (seguras de importar en el hilo de UI). */

/** Mensaje que el usuario firma para derivar su clave eERC de forma determinística. */
export const keyDerivationMessage = (address: string, chainId: number | bigint) =>
	[
		"Trasluz · clave de cifrado eERC",
		"",
		"Firmar este mensaje deriva tu clave privada de cifrado (BabyJubJub).",
		"No envía ninguna transacción ni cuesta gas.",
		"Nunca firmes este mensaje en un sitio que no sea Trasluz.",
		"",
		`Cuenta: ${address.toLowerCase()}`,
		`Chain ID: ${chainId}`,
		"Versión: 1",
	].join("\n");

export const privateKeyToHex = (k: bigint) => `0x${k.toString(16).padStart(64, "0")}`;

export const parseViewingKey = (input: string): bigint => {
	const s = input.trim();
	if (/^0x[0-9a-fA-F]{1,64}$/.test(s)) return BigInt(s);
	if (/^\d{1,78}$/.test(s)) return BigInt(s);
	throw new Error("Formato de clave inválido (esperado 0x… hex o decimal)");
};
