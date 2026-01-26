import { useWallet } from "@/contexts/wallet-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Transaction } from "@solana/web3.js";
import {
  fetchRecentBlockhash,
  sendSignedTransaction,
} from "@/lib/blockchain/solana-client";
import { X, Check } from "lucide-react";

interface PrivateDepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PrivateDepositModal({
  open,
  onOpenChange,
  onSuccess,
}: PrivateDepositModalProps) {
  const { activeAccount, shadowWireClient, isPrivateMode, signTransaction } =
    useWallet();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [signature, setSignature] = useState<string | null>(null);

  const handleDeposit = async () => {
    if (!activeAccount || !shadowWireClient || !isPrivateMode) return;

    try {
      setStatus("loading");
      setError(null);

      const depositTx = await shadowWireClient.deposit({
        wallet: activeAccount.address,
        amount: parseFloat(amount) * 1e9, // Convert to lamports
      });

      const unsignedTx = Transaction.from(
        Buffer.from(depositTx.unsigned_tx_base64, "base64"),
      );

      // Sign with the active account's keypair
      const signedTx = await signTransaction(unsignedTx);
      const txSignature = await sendSignedTransaction(signedTx);
      setSignature(txSignature);

      setStatus("success");
      setAmount("");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  const handleVerify = () => {
    if (signature) {
      window.open(`https://solscan.io/tx/${signature}`, "_blank");
      if (onSuccess) onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px]">
        {status === "error" ? (
          <div className="flex flex-col items-center gap-4">
            <X className="h-12 w-12 text-destructive" />
            <h3 className="text-lg font-semibold">Failed deposit</h3>
            <p className="text-sm text-destructive">{error}</p>
            <Button
              onClick={() => {
                setStatus("idle");
                onOpenChange(false);
                setTimeout(() => onOpenChange(true), 10);
              }}
              className="mt-4"
            >
              Try again
            </Button>
          </div>
        ) : status === "success" ? (
          <div className="flex flex-col items-center gap-4">
            <Check className="h-12 w-12 text-green-500" />
            <h3 className="text-lg font-semibold">Deposit successful</h3>
            <Button onClick={handleVerify} className="mt-4">
              Verify
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              The pool you deposited to is private on the transaction history
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Private Deposit</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground text-center">
                Send SOL to your private pool
              </p>

              <div className="flex flex-col gap-4 w-full">
                <Label htmlFor="amount">Amount in SOL</Label>
                <Input
                  id="amount"
                  type="number"
                  step=".1"
                  min={0.1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  disabled={!isPrivateMode || !shadowWireClient}
                />
                <Button
                  onClick={handleDeposit}
                  disabled={!amount || status === "loading" || !isPrivateMode}
                  className="w-full"
                >
                  {status === "loading" ? "Processing..." : "Deposit"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
