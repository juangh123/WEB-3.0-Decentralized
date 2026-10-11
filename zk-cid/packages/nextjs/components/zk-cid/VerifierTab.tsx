type VerifierTabProps = {
  walletAddress?: string;
  hasProof: boolean;
  hasMinted: boolean | undefined;
  isVerifying: boolean;
  onVerifyProof: () => void;
};

export const VerifierTab = ({ walletAddress, hasProof, hasMinted, isVerifying, onVerifyProof }: VerifierTabProps) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-2xl font-bold">
          第三步：业务端链上零知识验证与权限解锁
          <span className="block text-sm font-normal opacity-70 mt-1">
            Step 3 · DeFi gate verifies the proof on-chain and mints the AccessNFT
          </span>
        </h2>
        <span className="badge badge-accent badge-outline text-xs shrink-0">DeFi / DApp Gate</span>
      </div>
      <p className="text-sm opacity-80 leading-relaxed">
        DeFi 协议或 DApp 智能合约在链上直接验证 Groth16 零知识证明。验证通过后即可铸造 AccessNFT，赋予合规交易权限。
      </p>

      <div className="bg-base-300 p-4 rounded-xl border border-base-content/10 flex flex-col gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-base-content/70">当前钱包地址:</span>
          <span className="font-mono font-bold">{walletAddress || "未连接钱包"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-base-content/70">ZK 证明就绪状态:</span>
          <span className={`font-bold ${hasProof ? "text-success" : "text-warning"}`}>
            {hasProof ? "已在本地生成证明" : "未生成 (请先在 Tab 1 生成)"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-base-content/70">AccessNFT 拥有状态:</span>
          <span className="font-bold">{hasMinted ? "已持有合规通行证" : "未持有"}</span>
        </div>
      </div>

      <button
        className="btn btn-accent w-full text-white font-bold"
        onClick={onVerifyProof}
        disabled={!hasProof || hasMinted || isVerifying}
      >
        {isVerifying ? (
          <>
            <span className="loading loading-spinner"></span> 链上正在验证 ZK 证明并铸造 NFT...
          </>
        ) : hasMinted ? (
          "已验证合规身份 (AccessNFT 已铸造)"
        ) : !hasProof ? (
          "请先在 Tab 1 生成零知识证明"
        ) : (
          "提交链上验证并铸造 AccessNFT"
        )}
      </button>

      {hasMinted && (
        <div className="mt-4 p-6 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-2xl text-white shadow-2xl transition-all duration-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-2xl font-extrabold flex items-center gap-2">
              <span className="text-3xl">🔓</span> 合规 DeFi 隐私金库已解锁！
            </h3>
            <span className="badge badge-warning badge-lg font-bold text-gray-900">Verified Access</span>
          </div>
          <p className="opacity-90 text-sm mb-4 leading-relaxed">
            恭喜！您的钱包已通过零知识证明链上验证，成功进入受监管的高净值合规流动性池，链上合约无法追溯您的真实身份。
          </p>

          <div className="bg-white/15 p-4 rounded-xl backdrop-blur-md border border-white/20 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-sm opacity-90">模拟合规资金池余额:</span>
              <span className="font-mono text-2xl font-black text-amber-300">100.00 USDC</span>
            </div>
            <p className="text-xs opacity-75">* 此为实测 Demo 展示面板，已完成完整的链上闭环验证。</p>
            <div className="flex gap-3 pt-1">
              <button className="btn btn-sm flex-1 border-none bg-white text-indigo-700 hover:bg-gray-100 font-bold">
                Swap 隐私闪兑
              </button>
              <button className="btn btn-sm flex-1 border-none bg-indigo-900 text-white hover:bg-indigo-950 font-bold">
                Stake 合规质押
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
