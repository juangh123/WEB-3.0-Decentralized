import { useState } from "react";
import { Identity } from "@semaphore-protocol/identity";
import { useSignMessage } from "wagmi";
import { notification } from "~~/utils/scaffold-eth";

export const useIdentity = () => {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signMessageAsync } = useSignMessage();

  const createIdentity = () => {
    // Generate a fresh random identity
    const newIdentity = new Identity();
    // Do not save to localStorage for security
    setIdentity(newIdentity);
    return newIdentity;
  };

  const createDeterministicIdentity = async (address?: string) => {
    if (!address) {
      notification.error("Please connect your wallet first");
      return null;
    }
    setIsLoading(true);
    try {
      // Domain-separated, wallet-bound and stable: the same wallet always derives the same
      // identity for this app + chain, while a generic "sign in" message from another site
      // cannot reproduce it. Changing this template invalidates previously derived identities.
      const domain = typeof window !== "undefined" ? window.location.host : "zk-cid.local";
      const message = [
        "ZK-CID Anonymous Identity",
        "",
        "Sign this message to derive your Semaphore identity locally.",
        "This signature never leaves your device and cannot move funds.",
        "",
        `Domain: ${domain}`,
        "Chain ID: 11155111",
        `Wallet: ${address.toLowerCase()}`,
        "Version: 1",
      ].join("\n");
      const signature = await signMessageAsync({ message });

      // Use the signature as entropy to generate a deterministic identity
      const newIdentity = new Identity(signature);
      // Do not save to localStorage for security
      setIdentity(newIdentity);
      notification.success("Deterministic Identity created!");
      return newIdentity;
    } catch (e) {
      console.error(e);
      notification.error("Failed to sign message or generate identity.");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const clearIdentity = () => {
    setIdentity(null);
  };

  return { identity, createIdentity, createDeterministicIdentity, clearIdentity, isLoading };
};
