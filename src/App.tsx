import { useEffect } from "react";
import { WalletShell } from "../components/wallet/wallet-shell";
import { useWallet } from "../contexts/wallet-context";
import {
  ShadowWireClient,
  WASMNotSupportedError,
  initWASM,
  isWASMSupported,
} from "@radr/shadowwire";

export default function App() {
  const {
    isOnboarded,
    isShadowWireInitialized,
    setShadowWireClient,
    setIsShadowWireInitialized,
  } = useWallet();

  useEffect(() => {
    if (!isOnboarded) {
      // Send message to service worker to open onboarding tab
      chrome.runtime.sendMessage({ type: "OPEN_ONBOARDING" });
      // Close the popup
      window.close();
    }
  }, [isOnboarded]);

  // Init shadowwire client and wasm
  useEffect(() => {
    async function initShadowWire() {
      try {
        // Initialize WASM if in private mode
        if (!isWASMSupported()) {
          throw new WASMNotSupportedError();
        }

        const client = new ShadowWireClient({
          debug: true, // TODO: remove for production
        });

        await initWASM("wasm/settler_wasm_bg.wasm");
        setShadowWireClient(client);
        setIsShadowWireInitialized(true);
      } catch (error) {
        console.error("Failed to initialize ShadowWire:", error);
      }
    }
    if (!isShadowWireInitialized) {
      initShadowWire();
    }
  }, [isShadowWireInitialized]);

  if (!isOnboarded) {
    return (
      <div className="flex items-center justify-center h-64 w-80">
        <p className="text-muted-foreground">Opening setup...</p>
      </div>
    );
  }

  return <WalletShell key="wallet-shell" />;
}
