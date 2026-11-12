export const ZK_CIRCUITS = {
	registration: { wasm: "/zk/registration/registration.wasm", zkey: "/zk/registration/circuit_final.zkey" },
	transfer: { wasm: "/zk/transfer/transfer.wasm", zkey: "/zk/transfer/transfer.zkey" },
	withdraw: { wasm: "/zk/withdraw/withdraw.wasm", zkey: "/zk/withdraw/circuit_final.zkey" },
} as const;

export type CircuitName = keyof typeof ZK_CIRCUITS;
