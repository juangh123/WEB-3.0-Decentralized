import { RevocationFeed } from "./RevocationFeed";

type OnChainStatePanelProps = {
  gateAddress?: string;
  groupId?: bigint;
  groupMemberCount: number;
  isMembersLoading: boolean;
  isDemoMode?: boolean;
  issuerAddress?: string;
  workflowAddress?: string;
};

export const OnChainStatePanel = ({
  gateAddress,
  groupId,
  groupMemberCount,
  isMembersLoading,
  isDemoMode,
  issuerAddress,
  workflowAddress,
}: OnChainStatePanelProps) => {
  return (
    <div className="w-full max-w-3xl mt-6 bg-base-200 p-5 rounded-2xl border border-base-300 text-xs">
      <h3 className="text-sm font-bold mb-3">
        链上实时状态 (Sepolia) <span className="font-normal opacity-60">· Live On-Chain State</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <div className="flex justify-between gap-3">
          <span className="opacity-70">ComplianceGate</span>
          {gateAddress ? (
            <a
              className="link font-mono"
              href={`https://sepolia.etherscan.io/address/${gateAddress}`}
              target="_blank"
              rel="noreferrer"
            >
              {gateAddress.slice(0, 10)}…{gateAddress.slice(-6)}
            </a>
          ) : (
            <span className="font-mono">加载中...</span>
          )}
        </div>
        <div className="flex justify-between gap-3">
          <span className="opacity-70">群组 ID</span>
          <span className="font-mono">{groupId?.toString() ?? "加载中..."}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="opacity-70">源码验证 / Verified</span>
          {gateAddress ? (
            <span className="flex gap-2 font-mono">
              <a
                className="link"
                href={`https://eth-sepolia.blockscout.com/address/${gateAddress}#code`}
                target="_blank"
                rel="noreferrer"
              >
                Blockscout
              </a>
              <a
                className="link"
                href={`https://sourcify.dev/server/repo-ui/11155111/${gateAddress}`}
                target="_blank"
                rel="noreferrer"
              >
                Sourcify
              </a>
            </span>
          ) : (
            <span className="font-mono">加载中...</span>
          )}
        </div>
        <div className="flex justify-between gap-3">
          <span className="opacity-70">链上成员数</span>
          <span className="font-mono">{isMembersLoading ? "加载中..." : groupMemberCount}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="opacity-70">Demo Mode</span>
          <span className="font-mono">{isDemoMode === undefined ? "加载中..." : String(isDemoMode)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="opacity-70">Issuer</span>
          <span className="font-mono">
            {issuerAddress ? `${(issuerAddress as string).slice(0, 10)}…` : "加载中..."}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="opacity-70">CRE Workflow</span>
          <span className="font-mono">
            {workflowAddress ? `${(workflowAddress as string).slice(0, 10)}…` : "加载中..."}
          </span>
        </div>
      </div>
      <RevocationFeed />
    </div>
  );
};
