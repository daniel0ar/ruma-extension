import React from 'react';
import { WalletShell } from '../components/wallet/wallet-shell';
import { useWallet } from '../contexts/wallet-context';
import OnboardingFlow from './onboarding';

export default function App() {
  const { isOnboarded } = useWallet();
  
  if (!isOnboarded) {
    return <OnboardingFlow />;
  }
  
  return <WalletShell />;
}
