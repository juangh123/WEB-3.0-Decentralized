import { useState } from "react";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { SemaphoreProof, generateProof } from "@semaphore-protocol/proof";

export const useProof = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [proof, setProof] = useState<SemaphoreProof | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 生成 ZK 证明
   * @param identity 用户的 Semaphore 身份
   * @param groupMembers 链上或者后端的群组成员（Identity Commitments）
   * @param groupId 群组ID (Scope)
   * @param userAddress 用户的以太坊地址 (作为 message, 防抢跑)
   */
  const generateZkProof = async (
    identity: Identity,
    groupMembers: string[],
    groupId: bigint | string,
    userAddress: string,
  ) => {
    setIsGenerating(true);
    setError(null);
    try {
      // 1. 重建包含所有成员的群组
      const group = new Group(groupMembers);

      // 2. 将目标用户的以太坊地址作为 Message，绑定此证明只能由该地址提交
      // 需要将 address 转换为数字形式 (bigint/string) 以符合 Semaphore Message 格式
      const message = BigInt(userAddress).toString();
      const scope = groupId.toString();

      // 3. 浏览器端生成 ZK Proof (无需下载巨型 wasm/zkey, Semaphore v4 已优化)
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
