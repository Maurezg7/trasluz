import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { MockUSDCAbi, RegistrarAbi, SettlementManagerAbi } from "../abi";
import { getDeployment } from "../config";
import type { Ctx } from "../lib/eerc";
import { fetchEntidades, fetchObligaciones } from "../lib/chain";
import { sameAddr } from "../lib/format";

export const useDeployment = () => {
	const chainId = useChainId();
	return getDeployment(chainId);
};

/** Contexto de cadena para las operaciones eERC. `ctx` es null si la red no tiene deployment. */
export const useCtx = () => {
	const d = useDeployment();
	const pc = usePublicClient();
	const { address, isConnected } = useAccount();
	const ctx: Ctx | null = d && pc ? { d, pc: pc as Ctx["pc"], account: address } : null;
	return { ctx, d, address, isConnected };
};

/** Estado de la entidad conectada: KYC, registro eERC, owner/auditor, saldos públicos. */
export const useEntity = (who?: Address) => {
	const { ctx, d } = useCtx();
	return useQuery({
		queryKey: ["entity", d?.chainId, who],
		enabled: !!ctx && !!who,
		refetchInterval: 10_000,
		queryFn: async () => {
			const c = ctx!;
			const a = who!;
			const [habilitada, registrada, pk, usdc, owner] = await Promise.all([
				c.pc.readContract({ address: c.d.contracts.settlementManager, abi: SettlementManagerAbi, functionName: "habilitada", args: [a] }),
				c.pc.readContract({ address: c.d.contracts.registrar, abi: RegistrarAbi, functionName: "isUserRegistered", args: [a] }),
				c.pc.readContract({ address: c.d.contracts.registrar, abi: RegistrarAbi, functionName: "getUserPublicKey", args: [a] }),
				c.pc.readContract({ address: c.d.contracts.usdc, abi: MockUSDCAbi, functionName: "balanceOf", args: [a] }),
				c.pc.readContract({ address: c.d.contracts.settlementManager, abi: SettlementManagerAbi, functionName: "owner" }),
			]);
			return {
				habilitada,
				registrada,
				publicKey: [pk[0], pk[1]] as [bigint, bigint],
				usdc,
				isOwner: sameAddr(owner, a),
				isAuditor: sameAddr(c.d.auditor, a),
				gas: await c.pc.getBalance({ address: a }),
			};
		},
	});
};

export const useObligaciones = () => {
	const { ctx, d } = useCtx();
	return useQuery({
		queryKey: ["obligaciones", d?.chainId],
		enabled: !!ctx,
		refetchInterval: 8_000,
		queryFn: () => fetchObligaciones(ctx!.pc, ctx!.d),
	});
};

export const useEntidades = () => {
	const { ctx, d } = useCtx();
	return useQuery({
		queryKey: ["entidades", d?.chainId],
		enabled: !!ctx,
		refetchInterval: 20_000,
		queryFn: () => fetchEntidades(ctx!.pc, ctx!.d),
	});
};
