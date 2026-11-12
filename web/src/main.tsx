import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import App from "./App";
import { WalletProvider } from "./components/Wallet";
import { wagmiConfig } from "./config";
import { Toaster } from "./state/toast";
import { ActionProvider } from "./state/action";
import { KeyProvider } from "./state/keys";

const queryClient = new QueryClient({
	defaultOptions: { queries: { staleTime: 4_000, retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<WagmiProvider config={wagmiConfig}>
			<QueryClientProvider client={queryClient}>
				<WalletProvider>
					<KeyProvider>
						<BrowserRouter>
							<ActionProvider>
								<App />
							</ActionProvider>
						</BrowserRouter>
						<Toaster />
					</KeyProvider>
				</WalletProvider>
			</QueryClientProvider>
		</WagmiProvider>
	</StrictMode>,
);
