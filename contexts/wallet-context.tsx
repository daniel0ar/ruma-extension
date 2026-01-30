"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type {
  Account,
  WalletState,
  TokenBalance,
  Transaction,
} from "@/lib/blockchain/types";
import {
  SOL_TOKEN,
  USDC_TOKEN,
  WALLET_STATE_KEY,
  ONBOARDING_COMPLETE_KEY,
} from "@/lib/blockchain/constants";
import { getRandomColor, generateAccountId } from "@/lib/blockchain/utils";
import {
  getAllBalances,
  getTransactions as fetchSolanaTransactions,
  fetchRecentBlockhash,
} from "@/lib/blockchain/solana-client";
import * as bip39 from "bip39";
import {
  Keypair,
  Transaction as SolanaTransaction,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { ShadowWireClient } from "@radr/shadowwire";
import { EncryptionService, getBalanceFromUtxos } from "privacycash/utils";
export * from "privacycash/utils";

interface WalletContextType {
  // State
  accounts: Account[];
  activeAccount: Account | null;
  isPrivateMode: boolean;
  balances: TokenBalance[];
  transactions: Transaction[];
  isLoading: boolean;
  isOnboarded: boolean;

  // Actions
  setPrivateMode: (enabled: boolean) => void;
  setActiveAccount: (accountId: string) => void;
  createNewAccount: () => Promise<{ mnemonic: string; account: Account }>;
  importAccount: (
    method: "mnemonic" | "privateKey",
    value: string,
  ) => Promise<Account>;
  updateAccountName: (accountId: string, name: string) => void;
  refreshBalances: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  completeOnboarding: (account: Account) => void;
  signTransaction: (tx: SolanaTransaction) => Promise<SolanaTransaction>;
  signVersionedTransaction: (
    tx: VersionedTransaction,
  ) => Promise<VersionedTransaction>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;

  // Privacy clients
  shadowWireClient: ShadowWireClient | null;
  setShadowWireClient: (client: ShadowWireClient) => void;
  isShadowWireInitialized: boolean;
  setIsShadowWireInitialized: (isShadowWireInitialized: boolean) => void;
  isPrivacyCashInitialized: boolean;
  setIsPrivacyCashInitialized: (isPrivacyCashInitialized: boolean) => void;
  encryptionService: EncryptionService | null;
  setEncryptionService: (encryptionService: EncryptionService) => void;
  connection;
}

const STORE_NAME = "ruma-keypairs";

async function initBrowserDB() {
  return new Promise<void>((resolve) => {
    const transaction = indexedDB.open("WalletDB", 1);
    transaction.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.createObjectStore(STORE_NAME);
    };
    transaction.onsuccess = () => resolve();
  });
}

async function getKeypairFromStorage(
  accountId: string,
): Promise<Keypair | null> {
  return new Promise((resolve) => {
    const transaction = indexedDB.open("WalletDB", 1);
    transaction.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(accountId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    };
  });
}

async function storeKeypair(
  accountId: string,
  keypair: Keypair,
): Promise<void> {
  return new Promise((resolve) => {
    const transaction = indexedDB.open("WalletDB", 1);
    transaction.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put((keypair as any)._keypair, accountId); // TODO: Check why _keypair object exists inside Keypair
      tx.oncomplete = () => resolve();
    };
  });
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

async function deriveKeypairFromMnemonic(
  mnemonic: string,
  accountIndex = 0,
): Promise<Keypair> {
  // Use bip39 to convert mnemonic to seed
  const seed = bip39.mnemonicToSeedSync(mnemonic);

  // Use first 32 bytes as seed, combined with account index for derivation
  const seedArray = new Uint8Array(seed);
  let finalSeed = seedArray.slice(0, 32);

  // If accountIndex > 0, derive a child key by hashing seed with index
  if (accountIndex > 0) {
    const indexBuffer = new Uint8Array(4);
    new DataView(indexBuffer.buffer).setUint32(0, accountIndex, true);
    const combined = new Uint8Array([...finalSeed, ...indexBuffer]);
    const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
    finalSeed = new Uint8Array(hashBuffer);
  }

  const keypair = nacl.sign.keyPair.fromSeed(finalSeed);
  return Keypair.fromSecretKey(keypair.secretKey);
}

// Create keypair from private key (base58 encoded)
function keypairFromPrivateKey(privateKey: string): Keypair {
  const decoded = bs58.decode(privateKey);
  return Keypair.fromSecretKey(decoded);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(() => {
    // Check localStorage for existing state
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(WALLET_STATE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Invalid stored state, start fresh
        }
      }
    }
    return {
      accounts: [],
      activeAccountId: "",
      isPrivateMode: false,
      isOnboarded: false,
    };
  });

  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [shadowWireClient, setShadowWireClient] =
    useState<ShadowWireClient | null>(null);
  const [isShadowWireInitialized, setIsShadowWireInitialized] = useState(false);
  const [isPrivacyCashInitialized, setIsPrivacyCashInitialized] =
    useState(false);
  const [encryptionService, setEncryptionService] =
    useState<EncryptionService | null>(null);

  const activeAccount =
    state.accounts.find((a) => a.id === state.activeAccountId) || null;

  // Persist state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(WALLET_STATE_KEY, JSON.stringify(state));
    }
  }, [state]);

  useEffect(() => {
    initBrowserDB();
  }, []);

  const fetchPrivacyBalances = async (address: string) => {
    const results = {
      shadowwire: { sol: 0, usdc: 0 },
      privacycash: { sol: 0, usdc: 0 },
    };

    // Fetch ShadowWire balances
    if (shadowWireClient) {
      try {
        const balance = await shadowWireClient.getBalance(address, "SOL");
        results.shadowwire.sol = balance.available / 1e9;
        // TODO: Fetch USDC balance
      } catch (error) {
        console.error("Failed to fetch ShadowWire balances:", error);
      }
    }

    // Fetch PrivacyCash balances
    if (isPrivacyCashInitialized) {
      try {
        const balance = { lamports: 1000000000 }; // TODO: Find balance function for privacycash, maybe await getBalanceFromUtxos();
        results.privacycash.sol = balance.lamports / 1e9;
        // TODO: Fetch USDC balance
      } catch (error) {
        console.error("Failed to fetch PrivacyCash balances:", error);
      }
    }

    return results;
  };

  // Fetch real balances from mainnet and privacy protocols
  const refreshBalances = useCallback(async () => {
    if (!activeAccount) {
      setBalances([
        { token: SOL_TOKEN, balance: 0, usdValue: 0 },
        { token: USDC_TOKEN, balance: 0, usdValue: 0 },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      const newBalances: TokenBalance[] = [];

      // Fetch prices from CoinGecko
      let solPrice = 0;
      let usdcPrice = 1;
      try {
        const priceResponse = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin&vs_currencies=usd",
          { cache: "force-cache" },
        );
        const prices = await priceResponse.json();
        solPrice = prices.solana?.usd || 0;
        usdcPrice = prices["usd-coin"]?.usd || 1;
      } catch {
        // Price fetch failed, use defaults
      }

      if (state.isPrivateMode) {
        // Fetch privacy protocol balances
        const privacyBalances = await fetchPrivacyBalances(
          activeAccount.address,
        );

        // Add ShadowWire balances
        if (privacyBalances.shadowwire.sol > 0) {
          newBalances.push({
            token: SOL_TOKEN,
            balance: privacyBalances.shadowwire.sol,
            usdValue: privacyBalances.shadowwire.sol * solPrice,
            protocol: "shadowwire",
          });
        }
        if (privacyBalances.shadowwire.usdc > 0) {
          newBalances.push({
            token: USDC_TOKEN,
            balance: privacyBalances.shadowwire.usdc,
            usdValue: privacyBalances.shadowwire.usdc * usdcPrice,
            protocol: "shadowwire",
          });
        }

        // Add PrivacyCash balances
        if (privacyBalances.privacycash.sol > 0) {
          newBalances.push({
            token: SOL_TOKEN,
            balance: privacyBalances.privacycash.sol,
            usdValue: privacyBalances.privacycash.sol * solPrice,
            protocol: "privacycash",
          });
        }
        if (privacyBalances.privacycash.usdc > 0) {
          newBalances.push({
            token: USDC_TOKEN,
            balance: privacyBalances.privacycash.usdc,
            usdValue: privacyBalances.privacycash.usdc * usdcPrice,
            protocol: "privacycash",
          });
        }

        // If no private balances, show zero balances
        if (newBalances.length === 0) {
          newBalances.push(
            {
              token: SOL_TOKEN,
              balance: 0,
              usdValue: 0,
              protocol: "shadowwire",
            },
            {
              token: USDC_TOKEN,
              balance: 0,
              usdValue: 0,
              protocol: "shadowwire",
            },
          );
        }
      } else {
        // Fetch mainnet balances
        const mainnetBalances = await getAllBalances(activeAccount.address);
        newBalances.push(
          {
            token: SOL_TOKEN,
            balance: mainnetBalances.sol || 0,
            usdValue: (mainnetBalances.sol || 0) * solPrice,
          },
          {
            token: USDC_TOKEN,
            balance: mainnetBalances.usdc || 0,
            usdValue: (mainnetBalances.usdc || 0) * usdcPrice,
          },
        );
      }

      setBalances(newBalances);
    } catch (error) {
      console.error("Failed to fetch balances:", error);
      setBalances([
        { token: SOL_TOKEN, balance: 0, usdValue: 0 },
        { token: USDC_TOKEN, balance: 0, usdValue: 0 },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeAccount,
    state.isPrivateMode,
    isShadowWireInitialized,
    isPrivacyCashInitialized,
  ]);

  // Fetch real transactions from devnet
  const refreshTransactions = useCallback(async () => {
    if (!activeAccount || state.isPrivateMode) {
      setTransactions([]);
      return;
    }

    try {
      const txs = await fetchSolanaTransactions(activeAccount.address, 10);
      setTransactions(txs);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
      setTransactions([]);
    }
  }, [activeAccount, state.isPrivateMode]);

  // Refresh balances on mount and when active account changes
  useEffect(() => {
    if (state.isOnboarded) {
      refreshBalances();
      refreshTransactions();
    }
  }, [refreshBalances, refreshTransactions, state.isOnboarded]);

  const setPrivateMode = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, isPrivateMode: enabled }));
  }, []);

  const setActiveAccount = useCallback((accountId: string) => {
    setState((prev) => ({ ...prev, activeAccountId: accountId }));
  }, []);

  const createNewAccount = useCallback(async () => {
    // Generate real BIP39 mnemonic
    const mnemonic = bip39.generateMnemonic();
    const keypair = await deriveKeypairFromMnemonic(mnemonic);

    const newAccount: Account = {
      id: generateAccountId(),
      name: `Account ${state.accounts.length + 1}`,
      address: keypair.publicKey.toBase58(),
      publicKey: keypair.publicKey.toBase58(),
      color: getRandomColor(),
      isImported: false,
    };

    await storeKeypair(newAccount.id, keypair);

    setState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, newAccount],
      activeAccountId: newAccount.id,
    }));

    return { mnemonic, account: newAccount };
  }, [state.accounts.length]);

  const importAccount = useCallback(
    async (
      method: "mnemonic" | "privateKey",
      value: string,
    ): Promise<Account> => {
      let keypair: Keypair;

      if (method === "mnemonic") {
        if (!bip39.validateMnemonic(value)) {
          throw new Error("Invalid mnemonic phrase");
        }
        keypair = await deriveKeypairFromMnemonic(value);
      } else {
        keypair = keypairFromPrivateKey(value);
      }

      const newAccount: Account = {
        id: generateAccountId(),
        name: `Account ${state.accounts.length + 1}`,
        address: keypair.publicKey.toBase58(),
        publicKey: keypair.publicKey.toBase58(),
        color: getRandomColor(),
        isImported: true,
      };

      await storeKeypair(newAccount.id, keypair);

      setState((prev) => ({
        ...prev,
        accounts: [...prev.accounts, newAccount],
        activeAccountId: newAccount.id,
      }));

      return newAccount;
    },
    [state.accounts.length],
  );

  const updateAccountName = useCallback((accountId: string, name: string) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.id === accountId ? { ...a, name } : a,
      ),
    }));
  }, []);

  const completeOnboarding = useCallback((account: Account) => {
    setState((prev) => ({
      ...prev,
      accounts: [account],
      activeAccountId: account.id,
      isOnboarded: true,
    }));
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    }
  }, []);

  const signTransaction = useCallback(
    async (tx: SolanaTransaction) => {
      if (!activeAccount) {
        throw new Error("No active account");
      }
      const keypair = await getKeypairFromStorage(activeAccount.id);
      if (!keypair) {
        throw new Error("Signing key not found");
      }
      const correctTypeKeypair = Keypair.fromSecretKey(keypair.secretKey); //Temp fix for: tx.feePayer.toJSON fails (keypair.publicKey is Uint8Array(32) instead of PublicKey)
      tx.feePayer = correctTypeKeypair.publicKey;
      const latestBlockhash = await fetchRecentBlockhash(); // Temp fix for: Blockhash not found fails.
      tx.recentBlockhash = latestBlockhash; // Temp fix for: Blockhash not found fails.

      tx.partialSign(correctTypeKeypair);
      return tx;
    },
    [activeAccount],
  );

  const signVersionedTransaction = useCallback(
    async (tx: VersionedTransaction): Promise<VersionedTransaction> => {
      if (!activeAccount) {
        throw new Error("No active account");
      }
      const keypair = await getKeypairFromStorage(activeAccount.id);
      if (!keypair) {
        throw new Error("Signing key not found");
      }
      const correctTypeKeypair = Keypair.fromSecretKey(keypair.secretKey);

      tx.sign([correctTypeKeypair]);
      return tx;
    },
    [activeAccount],
  );

  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      if (!activeAccount) {
        throw new Error("No active account");
      }
      const keypair = await getKeypairFromStorage(activeAccount.id);
      if (!keypair) {
        throw new Error("Signing key not found");
      }

      // Use the correct keypair type
      const correctTypeKeypair = Keypair.fromSecretKey(keypair.secretKey);

      // Sign the message using the keypair
      const signature = nacl.sign.detached(
        message,
        correctTypeKeypair.secretKey,
      );

      return new Uint8Array(signature);
    },
    [activeAccount],
  );

  return (
    <WalletContext.Provider
      value={{
        accounts: state.accounts,
        activeAccount,
        isPrivateMode: state.isPrivateMode,
        balances,
        transactions,
        isLoading,
        isOnboarded: state.isOnboarded,
        setPrivateMode,
        setActiveAccount,
        createNewAccount,
        importAccount,
        updateAccountName,
        refreshBalances,
        refreshTransactions,
        completeOnboarding,
        shadowWireClient,
        setShadowWireClient,
        isShadowWireInitialized,
        setIsShadowWireInitialized,
        isPrivacyCashInitialized,
        setIsPrivacyCashInitialized,
        signTransaction,
        signVersionedTransaction,
        signMessage,
        encryptionService,
        setEncryptionService,
        connection,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
