"use client";

import { useState } from "react";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof, verifyProof } from "@semaphore-protocol/proof";

export default function ZKTestPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // 日志辅助函数
  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runZKFlow = async () => {
    setIsProcessing(true);
    setLogs([]); // 清空之前的日志

    try {
      // 1. 生成用户身份 (Identity)
      addLog("🔄 1. 正在生成用户零知识身份 (Identity)...");
      const identity = new Identity();
      addLog(`✅ 身份生成成功! Commitment: ${identity.commitment.toString().substring(0, 15)}...`);

      // 2. 创建合规群组并加入 (模拟 Issuer)
      addLog("🔄 2. 正在创建合规群组 (Group 1)，并将用户加入...");
      const group = new Group();
      group.addMember(identity.commitment);
      addLog(`✅ 加群成功! 当前群组人数: ${group.members.length}`);

      // 3. 生成 ZK 证明 (Proof)
      addLog("🔄 3. 正在生成 ZK 证明 (这需要几秒钟，正在下载 wasm/zkey 参数)...");
      const message = "I am compliant!"; // 你要签名的消息 (如: DeFi Action)
      const scope = "ComplianceGate_v1"; // 作用域，相当于 External Nullifier，防重放

      const proof = await generateProof(identity, group, message, scope);
      addLog(`✅ ZK 证明生成成功! Nullifier: ${proof.nullifier.toString().substring(0, 15)}...`);

      // 4. 验证 ZK 证明 (模拟 合约/Verifier)
      addLog("🔄 4. 正在验证 ZK 证明...");
      const isValid = await verifyProof(proof);

      if (isValid) {
        addLog("🎉 验证通过！证明有效，用户合规且未暴露隐私！");
      } else {
        addLog("❌ 验证失败！");
      }
    } catch (error: any) {
      addLog(`❌ 发生错误: ${error.message}`);
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-10 px-4 bg-base-200">
      <div className="max-w-2xl w-full bg-base-100 shadow-xl rounded-2xl p-8">
        <h1 className="text-3xl font-bold mb-2 text-center">🔐 ZK-CID 核心引擎测试</h1>
        <p className="text-center text-gray-500 mb-8">纯前端模拟：生成身份 → 加群 → 生成证明 → 验证</p>

        <div className="flex justify-center mb-8">
          <button className="btn btn-primary btn-lg" onClick={runZKFlow} disabled={isProcessing}>
            {isProcessing ? <span className="loading loading-spinner"></span> : "🚀 一键跑通 ZK 流程"}
          </button>
        </div>

        {/* 终端日志窗口 */}
        <div className="bg-black text-green-400 font-mono p-4 rounded-lg min-h-[300px] text-sm overflow-y-auto">
          {logs.length === 0 ? (
            <span className="text-gray-500">等待执行...</span>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-2">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
