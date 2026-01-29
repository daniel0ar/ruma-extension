import { PublicKey } from "@solana/web3.js";

export async function getSignedSignature(signed: Signed): Promise<Signed> {
  const encodedMessage = new TextEncoder().encode(
    `Privacy Money account sign in`,
  );

  // ask for sign
  let signature: Uint8Array;
  try {
    signature = await signed.provider.signMessage(encodedMessage);
  } catch (err: any) {
    if (
      err instanceof Error &&
      err.message?.toLowerCase().includes("user rejected")
    ) {
      throw new Error("User rejected the signature request");
    }
    throw new Error("Failed to sign message: " + err.message);
  }

  // If wallet.signMessage returned an object, extract `signature`
  // @ts-ignore
  if (signature.signature) {
    // @ts-ignore
    signature = signature.signature;
  }

  if (!(signature instanceof Uint8Array)) {
    throw new Error("signature is not an Uint8Array type");
  }
  signed.signature = signature;
  return signed;
}

export type Signed = {
  publicKey: PublicKey;
  signature?: Uint8Array;
  provider: any;
};
