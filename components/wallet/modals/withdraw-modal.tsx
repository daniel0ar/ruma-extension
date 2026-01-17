"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface WithdrawModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WithdrawModal({ open, onOpenChange }: WithdrawModalProps) {
  const [amount, setAmount] = useState("")
  const [selectedToken, setSelectedToken] = useState("SOL")
  const [isLoading, setIsLoading] = useState(false)

  const handleWithdraw = async () => {
    setIsLoading(true)
    // Simulate withdrawal from private balance
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsLoading(false)
    setAmount("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px]">
        <DialogHeader>
          <DialogTitle>Withdraw from Private Balance</DialogTitle>
          <DialogDescription>Withdraw funds from your shielded balance to your public wallet.</DialogDescription>
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
                <SelectItem value="USDC">USDC</SelectItem>
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
            />
          </div>

          <Button onClick={handleWithdraw} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Withdrawing...
              </>
            ) : (
              "Withdraw"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
