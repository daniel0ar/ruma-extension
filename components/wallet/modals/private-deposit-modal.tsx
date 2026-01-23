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

interface PrivateDepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivateDepositModal({
  open,
  onOpenChange,
}: PrivateDepositModalProps) {
  const { activeAccount, shadowWireClient, isPrivateMode } = useWallet();
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeposit = async () => {
    if (!activeAccount || !shadowWireClient || !isPrivateMode) return;

    try {
      setIsLoading(true);
      setError(null);

      const depositTx = await shadowWireClient.deposit({
        wallet: activeAccount.address,
        amount: parseFloat(amount) * 1e9, // Convert to lamports
      });

      // In a real implementation, you would:
      // 1. Sign the transaction with the wallet
      // 2. Send it to the blockchain
      // 3. Update local state

      console.log("Deposit transaction created:", depositTx);
      alert("Deposit transaction created! Sign it in your wallet.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px]">
        <DialogHeader>
          <DialogTitle>Private Deposit</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground text-center">
            Send SOL to your private pool
          </p>

          {/* QR Code Placeholder */}
          <div className="flex flex-col gap-4">
            <Label htmlFor="amount">Recipient Address</Label>
            <Input
              id="amount"
              type="number"
              step=".1"
              min={0.1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount in SOL"
              disabled={!isPrivateMode || !shadowWireClient}
            />
            <Button
              onClick={handleDeposit}
              disabled={!amount || isLoading || !isPrivateMode}
            >
              {isLoading ? "Processing..." : "Deposit"}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
