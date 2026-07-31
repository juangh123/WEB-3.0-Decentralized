import { useState } from "react";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";

export function useProof() {
  const [isProving, setIsProving] = useState(false);
  const [proof, setProof] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createProof = async (identity: Identity, groupMembers: string[], scope: string) => {
    setIsProving(true);
    setError(null);
    try {
      const group = new Group(groupMembers);

      const fullProof = await generateProof(identity, group, scope, scope);
      setProof(fullProof);
      return fullProof;
    } catch (err: any) {
      setError(err.message || "Failed to generate proof");
      return null;
    } finally {
      setIsProving(false);
    }
  };

  return { createProof, isProving, proof, error };
}
