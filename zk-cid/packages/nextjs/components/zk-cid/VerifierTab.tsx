"use client";

import { useLanguage } from "./LanguageContext";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

type VerifierTabProps = {
  walletAddress?: string;
  hasProof: boolean;
  hasMinted: boolean | undefined;
  isVerifying: boolean;
  mintTxHash?: `0x${string}`;
  accessNftAddress?: string;
  onVerifyProof: () => void;
};

export const VerifierTab = ({
  walletAddress,
  hasProof,
  hasMinted,
  isVerifying,
  mintTxHash,
  accessNftAddress,
  onVerifyProof,
}: VerifierTabProps) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-2xl font-bold">
          {t("第三步：业务端链上零知识验证与权限解锁", "Step 3 · Verify & Mint")}
          <span className="block text-sm font-normal opacity-70 mt-1">
            {t("业务端验证证明并铸造 AccessNFT", "The DeFi gate verifies the proof on-chain and mints the AccessNFT")}
          </span>
        </h2>
        <span className="badge badge-accent badge-outline text-xs shrink-0">DeFi / DApp Gate</span>
      </div>
      <p className="text-sm opacity-80 leading-relaxed">
        {t(
          "DeFi 协议或 DApp 智能合约在链上直接验证 Groth16 零知识证明。验证通过后即可铸造 AccessNFT，赋予合规交易权限。",
          "The DeFi protocol or DApp verifies the Groth16 proof on-chain. A successful check mints the AccessNFT and unlocks compliant trading access.",
        )}
      </p>

      <div className="bg-base-300 p-4 rounded-xl border border-base-content/10 flex flex-col gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-base-content/70">{t("当前钱包地址:", "Wallet address:")}</span>
          <span className="font-mono font-bold">{walletAddress || t("未连接钱包", "Wallet not connected")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-base-content/70">{t("ZK 证明就绪状态:", "ZK proof status:")}</span>
          <span className={`font-bold ${hasProof ? "text-success" : "text-warning"}`}>
            {hasProof
              ? t("已在本地生成证明", "Proof generated locally")
              : t("未生成 (请先在 Tab 1 生成)", "Not generated (use Tab 1)")}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-base-content/70">{t("AccessNFT 拥有状态:", "AccessNFT status:")}</span>
          <span className="font-bold">
            {hasMinted ? t("已持有合规通行证", "Compliance pass held") : t("未持有", "Not held")}
          </span>
        </div>
      </div>

      <button
        className="btn btn-accent w-full text-white font-bold"
        onClick={onVerifyProof}
        disabled={!hasProof || hasMinted || isVerifying}
      >
        {isVerifying ? (
          <>
            <span className="loading loading-spinner"></span>{" "}
            {t("链上正在验证 ZK 证明并铸造 NFT...", "Verifying the ZK proof on-chain and minting the NFT...")}
          </>
        ) : hasMinted ? (
          t("已验证合规身份 (AccessNFT 已铸造)", "Compliance verified (AccessNFT minted)")
        ) : !hasProof ? (
          t("请先在 Tab 1 生成零知识证明", "Generate a zero-knowledge proof in Tab 1 first")
        ) : (
          t("提交链上验证并铸造 AccessNFT", "Verify on-chain and mint AccessNFT")
        )}
      </button>

      {hasMinted && (
        <div className="mt-4 p-6 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-2xl text-white shadow-2xl transition-all duration-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-2xl font-extrabold flex items-center gap-2">
              <span className="text-3xl">🔓</span> {t("合规 DeFi 隐私金库已解锁！", "Compliant DeFi access unlocked")}
            </h3>
            <span className="badge badge-warning badge-lg font-bold text-gray-900">Verified Access</span>
          </div>
          <p className="opacity-90 text-sm mb-4 leading-relaxed">
            {t(
              "钱包已通过零知识证明的链上验证，获得 AccessNFT 访问权限。链上只记录匿名承诺、证明 nullifier 与持有凭证的钱包地址，不包含真实身份。",
              "The wallet passed on-chain zero-knowledge verification and now holds an AccessNFT. The chain stores only the anonymous commitment, the proof nullifier, and the wallet address; it does not contain the real identity.",
            )}
          </p>

          <div className="bg-white/15 p-4 rounded-xl backdrop-blur-md border border-white/20 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-sm opacity-90">{t("演示资金池余额:", "Demo pool balance:")}</span>
              <span className="font-mono text-2xl font-black text-amber-300">100.00 USDC</span>
            </div>
            <p className="text-xs opacity-75">
              {t(
                "* 演示数据，未接入真实资金池或 DeFi 协议。",
                "* Demo data. No real pool or DeFi protocol is connected.",
              )}
            </p>
            {mintTxHash ? (
              <a
                className="btn btn-sm border-none bg-white text-indigo-700 hover:bg-gray-100 font-bold"
                href={`https://eth-sepolia.blockscout.com/tx/${mintTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {t("在 Blockscout 查看铸造交易", "View mint transaction on Blockscout")}
              </a>
            ) : (
              accessNftAddress && (
                <a
                  className="btn btn-sm border-none bg-white text-indigo-700 hover:bg-gray-100 font-bold"
                  href={`https://eth-sepolia.blockscout.com/address/${accessNftAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  {t("在 Blockscout 查看 AccessNFT", "View AccessNFT on Blockscout")}
                </a>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
