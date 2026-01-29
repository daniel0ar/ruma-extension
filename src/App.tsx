import { useEffect } from "react";
import { WalletShell } from "../components/wallet/wallet-shell";
import { useWallet } from "../contexts/wallet-context";
import {
  ShadowWireClient,
  WASMNotSupportedError,
  initWASM,
  isWASMSupported,
} from "@radr/shadowwire";
import { PrivacyCash } from "privacycash";
import { FALLBACK_RPC_URLS } from "@/lib/blockchain/solana-client";

export default function App() {
  const {
    isOnboarded,
    isShadowWireInitialized,
    setShadowWireClient,
    setIsShadowWireInitialized,
    isPrivacyCashInitialized,
    setPrivacyCashClient,
    setIsPrivacyCashInitialized,
    activeAccount,
    getKeypairFromStorage,
  } = useWallet();

  useEffect(() => {
    if (!isOnboarded) {
      // Send message to service worker to open onboarding tab
      chrome.runtime.sendMessage({ type: "OPEN_ONBOARDING" });
      // Close the popup
      window.close();
    }
  }, [isOnboarded]);

  // Init privacy clients and wasm
  useEffect(() => {
    async function initPrivacyClients() {
      try {
        // Initialize WASM if supported
        if (!isWASMSupported()) {
          throw new WASMNotSupportedError();
        }

        // Initialize ShadowWire
        const shadowWireClient = new ShadowWireClient({
          debug: true, // TODO: remove for production
        });

        await initWASM("wasm/settler_wasm_bg.wasm");
        setShadowWireClient(shadowWireClient);
        setIsShadowWireInitialized(true);

        // Initialize PrivacyCash
        if (!activeAccount) {
          throw new Error("No active account");
        }
        const keypair = await getKeypairFromStorage(activeAccount.id);

        if (!keypair) {
          throw new Error("Keypair not found");
        }

        const privacyCashClient = new PrivacyCash({
          RPC_url: FALLBACK_RPC_URLS[0], // TODO: Find a way to use process.env.SOLANA_RPC_URL
          owner: keypair, // probably have to do Keypair.fromSecretKey(keypair.secretKey)
          enableDebug: false, // TODO: Remove for production
        });
        setPrivacyCashClient(privacyCashClient);
        setIsPrivacyCashInitialized(true);
      } catch (error) {
        console.error("Failed to initialize privacy clients:", error);
      }
    }
    if (!isShadowWireInitialized || !isPrivacyCashInitialized) {
      initPrivacyClients();
    }
  }, [isShadowWireInitialized, isPrivacyCashInitialized]);

  if (!isOnboarded) {
    return (
      <div className="flex items-center justify-center h-64 w-80">
        <p className="text-muted-foreground">Opening setup...</p>
      </div>
    );
  }

  return <WalletShell key="wallet-shell" />;
}
