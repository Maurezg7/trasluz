import type { KeyPair } from "@trasluz/zk";
import { keyDerivationMessage } from "@trasluz/zk/src/pure";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "./toast";
import { type Hex, isAddressEqual, keccak256, parseSignature, recoverMessageAddress, serializeSignature, size } from "viem";
import { useAccount, useChainId, usePublicClient, useSignMessage } from "wagmi";
import { RegistrarAbi } from "../abi/Registrar";
import { getDeployment } from "../config";
import { useAutoLock } from "../hooks/useAutoLock";
import { zk } from "../lib/prover";

type KeyState = {
	keyPair?: KeyPair;
	unlock: () => Promise<KeyPair>;
	lock: () => void;
	unlocking: boolean;
	/** Motivo por el que la wallet no sirve para derivar la clave (smart wallet, firma aleatoria…). */
	error?: string;
};

const KeyCtx = createContext<KeyState | null>(null);

export class IncompatibleWalletError extends Error {}

/**
 * La clave eERC sale de keccak256(firma). Sólo es segura si la firma es ECDSA de la propia
 * cuenta y determinística (RFC 6979): smart wallets (ERC-1271/6492), Safe o MPC con nonce
 * aleatorio darían una clave distinta en cada sesión y el saldo cifrado quedaría inaccesible.
 */
const canonicalSignature = async (sig: Hex, address: `0x${string}`, message: string) => {
	if (size(sig) !== 65) throw new IncompatibleWalletError("Tu wallet firma como contrato (smart wallet / ERC-1271). Trasluz necesita una cuenta EOA: Core, MetaMask, Rabby o una hardware wallet.");
	if (!isAddressEqual(await recoverMessageAddress({ message, signature: sig }), address))
		throw new IncompatibleWalletError("La firma no corresponde a la clave de esta cuenta (smart wallet o cuenta delegada). Usá una cuenta EOA.");
	// v=0/1 vs 27/28 según la wallet: se normaliza para que la misma cuenta dé la misma clave en cualquier wallet.
	return serializeSignature(parseSignature(sig));
};

/**
 * Clave eERC del usuario, derivada de una firma determinística (RFC 6979) de su wallet.
 * Vive SOLO en memoria: no se persiste ni se loguea; se borra al desconectar la wallet,
 * tras 15 min de inactividad o 5 min con la pestaña oculta.
 */
export function KeyProvider({ children }: { children: ReactNode }) {
	const { address, isConnected } = useAccount();
	const chainId = useChainId();
	const pc = usePublicClient();
	const { signMessageAsync } = useSignMessage();
	const [keys, setKeys] = useState<Record<string, KeyPair>>({});
	const [unlocking, setUnlocking] = useState(false);
	const [error, setError] = useState<{ id: string; msg: string }>();
	const id = address ? `${chainId}:${address.toLowerCase()}` : "";
	const hasKeys = Object.keys(keys).length > 0;

	useEffect(() => {
		if (!isConnected) setKeys({});
	}, [isConnected]);

	useAutoLock(hasKeys, () => {
		setKeys({});
		toast.info("Clave eERC bloqueada por inactividad", { description: "Volvé a firmar para continuar." });
	});

	const unlock = useCallback(async () => {
		if (!address) throw new Error("Conectá tu wallet");
		if (keys[id]) return keys[id];
		setUnlocking(true);
		setError(undefined);
		try {
			const message = keyDerivationMessage(address, chainId);
			const sig = await canonicalSignature(await signMessageAsync({ message }), address, message);
			const d = getDeployment(chainId);
			const registered = d && pc ? await pc.readContract({ address: d.contracts.registrar, abi: RegistrarAbi, functionName: "isUserRegistered", args: [address] }) : true;
			// Antes de registrar una clave para siempre, se comprueba que la wallet firma igual dos veces.
			if (!registered && (await canonicalSignature(await signMessageAsync({ message }), address, message)) !== sig)
				throw new IncompatibleWalletError("Tu wallet firma distinto cada vez (firma no determinística, típica de wallets MPC). La clave de cifrado no sería recuperable: usá Core, MetaMask, Rabby o una hardware wallet.");
			const kp = await zk.keyFromSeed(BigInt(keccak256(sig)));
			setKeys((k) => ({ ...k, [id]: kp }));
			zk.warm(["transfer", "registration"]);
			return kp;
		} catch (e) {
			if (e instanceof IncompatibleWalletError) {
				setError({ id, msg: e.message });
				toast.info("Wallet no compatible", { description: e.message });
			}
			throw e;
		} finally {
			setUnlocking(false);
		}
	}, [address, chainId, id, keys, pc, signMessageAsync]);

	const lock = useCallback(() => setKeys((k) => Object.fromEntries(Object.entries(k).filter(([key]) => key !== id))), [id]);

	const value = useMemo(
		() => ({ keyPair: keys[id], unlock, lock, unlocking, error: error?.id === id ? error.msg : undefined }),
		[keys, id, unlock, lock, unlocking, error],
	);
	return <KeyCtx.Provider value={value}>{children}</KeyCtx.Provider>;
}

export const useKeys = () => {
	const c = useContext(KeyCtx);
	if (!c) throw new Error("KeyProvider faltante");
	return c;
};
