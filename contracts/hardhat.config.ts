import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const accounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
	solidity: {
		// eERC oficial fija pragma 0.8.27; nuestros contratos usan ^0.8.24.
		version: "0.8.27",
		settings: { optimizer: { enabled: true, runs: 200 } },
	},
	networks: {
		hardhat: { chainId: 31337 },
		localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
		fuji: {
			url: process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
			chainId: 43113,
			accounts,
		},
	},
	typechain: { outDir: "typechain-types", target: "ethers-v6" },
	mocha: { timeout: 600_000 },
};

export default config;
