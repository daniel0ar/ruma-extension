"use client"

import { useEffect, useState } from "react"
import { WalletProvider, useWallet } from "@/contexts/wallet-context"
import { WalletShell } from "@/components/wallet/wallet-shell"
import { ONBOARDING_COMPLETE_KEY } from "@/lib/blockchain/constants"

function WalletApp() {
  const { isOnboarded } = useWallet()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true)

  useEffect(() => {
    // Check if onboarding is complete
    const onboardingComplete = localStorage.getItem(ONBOARDING_COMPLETE_KEY)
    if (!onboardingComplete && !isOnboarded) {
      // Open onboarding in new tab
      setShowOnboarding(true)
    }
    setIsCheckingOnboarding(false)
  }, [isOnboarded])

  useEffect(() => {
    if (showOnboarding && typeof window !== "undefined") {
      // Open onboarding in the current context (simulating new tab behavior for extension)
      window.location.href = "/onboarding"
    }
  }, [showOnboarding])

  if (isCheckingOnboarding) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-muted">
        <div className="wallet-extension flex flex-col items-center justify-center bg-background border border-border rounded-2xl shadow-2xl">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-muted">
      <WalletShell />
    </main>
  )
}

export default function Home() {
  return (
    <WalletProvider>
      <WalletApp />
    </WalletProvider>
  )
}
