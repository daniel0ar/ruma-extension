"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { formatBalance } from "@/lib/blockchain/utils";
import { generateRangeProof } from "@radr/shadowwire";

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PrivateTransferModal({
  open,
  onOpenChange,
  onSuccess,
}: TransferModalProps) {
  const { activeAccount, balances, shadowWireClient, isPrivateMode } =
    useWallet();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [selectedToken, setSelectedToken] = useState("SOL");

  const selectedBalance = balances.find(
    (b) => b.token.symbol === selectedToken,
  );
  const maxAmount = selectedBalance?.balance || 0;

  const handleSend = async () => {
    if (!activeAccount || !shadowWireClient || !isPrivateMode) return;

    try {
      setStatus("loading");
      setError(null);
      const proof = await generateRangeProof(parseFloat(amount) * 1e9, 64);

      const transferTx = await shadowWireClient.transferWithClientProofs({
        sender: activeAccount.address,
        recipient: recipient,
        amount: parseFloat(amount) * 1e9,
        token: "SOL",
        type: "internal",
        customProof: proof,
      });

      // Uncomment if necesary
      // const unsignedTx = Transaction.from(
      //   Buffer.from(transferTx.tx_signature, "base64"),
      // );

      // // Sign with the active account's keypair
      // const signedTx = await signTransaction(unsignedTx);
      // const txSignature = await sendSignedTransaction(signedTx);
      // setTxHash(txSignature);

      console.log("Transfer transaction:", transferTx.tx_signature);
      setTxHash(transferTx.tx_signature);
      setStatus("success");
      setAmount("");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  const handleMaxClick = () => {
    setAmount(maxAmount.toString());
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
              You have transfered your funds into a private pool. For best
              privacy, withdraw a different amount to a brand new wallet.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Send</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="recipient">Recipient Address</Label>
                <Input
                  id="recipient"
                  placeholder="Enter Solana address"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="mt-1.5 font-mono text-sm"
                />
              </div>

              <div>
                <Label htmlFor="token">Token</Label>
                <Select value={selectedToken} onValueChange={setSelectedToken}>
                  <SelectTrigger id="token" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {balances.map((b) => (
                      <SelectItem key={b.token.symbol} value={b.token.symbol}>
                        {b.token.symbol} ({formatBalance(b.balance)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="amount">Amount</Label>
                  <button
                    type="button"
                    onClick={handleMaxClick}
                    className="text-xs text-primary hover:underline"
                  >
                    Max: {formatBalance(maxAmount)}
                  </button>
                </div>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                onClick={handleSend}
                disabled={!amount || status === "loading" || !isPrivateMode}
                className="w-full"
              >
                {status === "loading" ? "Processing..." : "Transfer"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
