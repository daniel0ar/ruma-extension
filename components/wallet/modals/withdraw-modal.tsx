"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWallet } from "@/contexts/wallet-context";
import { Transaction } from "@solana/web3.js";
import { sendSignedTransaction } from "@/lib/blockchain/solana-client";
import { truncateAddress } from "@/lib/blockchain/utils";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function WithdrawModal({
  open,
  onOpenChange,
  onSuccess,
}: WithdrawModalProps) {
  const { activeAccount, shadowWireClient, isPrivateMode, signTransaction } =
    useWallet();
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("SOL");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleWithdraw = async () => {
    setIsLoading(true);
    // Simulate withdrawal from private balance
    if (!activeAccount || !shadowWireClient || !isPrivateMode) return;

    try {
      setStatus("loading");
      setError(null);

      const withdrawTx = await shadowWireClient.withdraw({
        wallet: activeAccount.address,
        amount: parseFloat(amount) * 1e9, // Convert to lamports
      });

      console.log("withdrawTx from shadowwire: ", withdrawTx);

      if (!withdrawTx.unsigned_tx_base64) {
        console.error("No withdraw transaction returned from Shadowwire");
        return;
      }

      const unsignedTx = Transaction.from(
        Buffer.from(withdrawTx.unsigned_tx_base64, "base64"),
      );

      console.log("withdrawTx after Transaction.from buffer: ", unsignedTx);

      // Sign with the active account's keypair
      const signedTx = await signTransaction(unsignedTx);

      console.log("withdrawTx after signing: ", signedTx);
      for (const signature of signedTx.signatures) {
        console.log("signer: ", signature.publicKey.toString());
      }

      const txSignatureHash = await sendSignedTransaction(signedTx);
      setTxHash(txSignatureHash);

      setStatus("success");
      setAmount("");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  const handleVerify = () => {
    if (txHash) {
      window.open(`https://solscan.io/tx/${txHash}`, "_blank");
      if (onSuccess) onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px]">
        {status === "error" ? (
          <div className="flex flex-col items-center gap-4">
            <X className="h-12 w-12 text-destructive" />
            <DialogTitle className="text-lg font-semibold">
              Failed withdraw
            </DialogTitle>
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
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Withdraw sucessful
              </DialogTitle>
            </DialogHeader>
            <Button onClick={handleVerify} className="mt-4">
              Verify
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Your funds are now public on wallet{" "}
              {activeAccount?.address
                ? truncateAddress(activeAccount?.address)
                : ""}
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Withdraw from Private Balance</DialogTitle>
              <DialogDescription>
                Withdraw funds from your shielded balance to your public wallet.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="withdraw-token">Token</Label>
                <Select value={selectedToken} onValueChange={setSelectedToken}>
                  <SelectTrigger id="withdraw-token" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOL">SOL</SelectItem>
                    {/* TODO: Uncomment when USD1 is implemented */}
                    {/* <SelectItem value="USDC">USDC</SelectItem > */}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="withdraw-amount">Amount</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1.5"
                  disabled={!isPrivateMode || !shadowWireClient}
                />
              </div>

              <Button
                onClick={handleWithdraw}
                disabled={!amount || status === "loading" || !isPrivateMode}
                className="w-full"
              >
                {status === "loading" ? "Processing..." : "Withdraw"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
