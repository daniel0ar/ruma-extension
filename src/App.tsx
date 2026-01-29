import { useEffect } from "react";
import { WalletShell } from "../components/wallet/wallet-shell";
import { useWallet } from "../contexts/wallet-context";
import {
  ShadowWireClient,
  WASMNotSupportedError,
  initWASM,
  isWASMSupported,
} from "@radr/shadowwire";
import { getSignedSignature } from "@/lib/privacycash/init-privacycash";
import { PublicKey } from "@solana/web3.js";
import { EncryptionService } from "privacycash/utils";
export * from "privacycash/utils";

export default function App() {
  const {
    isOnboarded,
    isShadowWireInitialized,
    setShadowWireClient,
    setIsShadowWireInitialized,
    isPrivacyCashInitialized,
    setIsPrivacyCashInitialized,
    activeAccount,
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

        const signed = await getSignedSignature({
          publicKey: new PublicKey(activeAccount.publicKey), // Had to convert from string to PublicKey from @solana/web3js
          provider: "", // correct?
        });
        let encryptionService = new EncryptionService();
        if (!signed.signature) {
          console.error("Privacy Cash failed to set signature");
          return;
        }
        encryptionService.deriveEncryptionKeyFromSignature(signed.signature);
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
