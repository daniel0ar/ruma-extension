import type { Token } from "./types"

// Solana devnet tokens
export const SOL_TOKEN: Token = {
  symbol: "SOL",
  name: "Solana",
  mint: "So11111111111111111111111111111111111111112",
  decimals: 9,
  logoUrl: "/tokens/sol.svg",
}

// Devnet USDC (use official devnet USDC faucet mint)
export const USDC_TOKEN: Token = {
  symbol: "USDC",
  name: "USD Coin",
  mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Devnet USDC
  decimals: 6,
  logoUrl: "/tokens/usdc.svg",
}

export const SUPPORTED_TOKENS = [SOL_TOKEN, USDC_TOKEN]

// Price API endpoints
export const COINGECKO_API = "https://api.coingecko.com/api/v3"

// Account avatar colors
export const AVATAR_COLORS = [
  "#1144ec",
  "#11b2ed",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#14b8a6",
]

// Onboarding storage key
export const ONBOARDING_COMPLETE_KEY = "solana_wallet_onboarding_complete"
export const WALLET_STATE_KEY = "solana_wallet_state"
