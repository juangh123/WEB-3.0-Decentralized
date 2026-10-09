import { useState } from "react";
import type { Identity } from "@semaphore-protocol/identity";
import type { SemaphoreProof } from "@semaphore-protocol/proof";

export const useProof = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [proof, setProof] = useState<SemaphoreProof | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 生成 ZK 证明
   * @param identity 用户的 Semaphore 身份
   * @param leaves 链上稳定的 Semaphore leaves（被撤销的叶子为 0，不能压缩）
   * @param groupId 群组ID (Scope)
   * @param userAddress 用户的以太坊地址 (作为 message, 防抢跑)
   */
  const generateZkProof = async (
    identity: Identity,
    leaves: string[],
    groupId: bigint | string,
    userAddress: string,
  ) => {
    setIsGenerating(true);
    setError(null);
    try {
      // 1. 重建与链上完全一致的群组。零值叶子必须保留，否则撤销后根会漂移。
      const { Group } = await import("@semaphore-protocol/group");
      const group = new Group(leaves);

      // 2. 将目标用户的以太坊地址作为 Message，绑定此证明只能由该地址提交
      // 需要将 address 转换为数字形式 (bigint/string) 以符合 Semaphore Message 格式
      const message = BigInt(userAddress).toString();
      const scope = groupId.toString();

      // 3. 浏览器端生成 ZK Proof (无需下载巨型 wasm/zkey, Semaphore v4 已优化)
      // Load the prover (and its snarkjs/WASM payload) only when a proof is actually
      // requested so the demo page does not ship ~1MB of ZK tooling on first paint.
      const { generateProof } = await import("@semaphore-protocol/proof");
      const generatedProof = await generateProof(identity, group, message, scope);

      setProof(generatedProof);
      return generatedProof;
    } catch (err: any) {
      console.error("Failed to generate ZK Proof:", err);
      setError(err.message || "Unknown error generating proof");
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const clearProof = () => {
    setProof(null);
    setError(null);
  };

  return { proof, generateZkProof, clearProof, isGenerating, error };
};
