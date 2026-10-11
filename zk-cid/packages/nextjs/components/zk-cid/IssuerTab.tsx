type IssuerTabProps = {
  hasIdentity: boolean;
  commitment: string;
  isMemberInGroup: boolean;
  groupId?: bigint;
  issuerAddress?: string;
  isIssuerWallet: boolean;
  demoIssuerEnabled: boolean;
  isDemoIssuing: boolean;
  isIssuing: boolean;
  onIssueCredential: () => void;
  onDemoIssue: () => void;
  onGoToUser: () => void;
};

export const IssuerTab = ({
  hasIdentity,
  commitment,
  isMemberInGroup,
  groupId,
  issuerAddress,
  isIssuerWallet,
  demoIssuerEnabled,
  isDemoIssuing,
  isIssuing,
  onIssueCredential,
  onDemoIssue,
  onGoToUser,
}: IssuerTabProps) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-2xl font-bold">
          第二步：Issuer 机构 KYC 与上链发证
          <span className="block text-sm font-normal opacity-70 mt-1">
            Step 2 · Issuer verifies KYC off-chain and adds the anonymous commitment on-chain
          </span>
        </h2>
        <span className="badge badge-secondary badge-outline text-xs shrink-0">Authority Role</span>
      </div>
      <p className="text-sm opacity-80 leading-relaxed">
        在此环节，合规发证机构验证链下身份（如护照、制裁名单筛查）后，将用户的匿名 Commitment 添加到链上 Semaphore
        合规群组中。
      </p>

      <div className="bg-base-300 p-4 rounded-xl border border-base-content/10 flex flex-col gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-base-content/70">目标群组 ID (Group ID):</span>
          <span className="font-mono font-bold">{groupId?.toString() || "加载中..."}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-base-content/70">待发证 Identity Commitment:</span>
          <span className="font-mono font-bold truncate max-w-[280px] sm:max-w-md">
            {commitment || "(未在 Tab 1 生成身份)"}
          </span>
        </div>
        <div className="flex justify-between items-center pt-1">
          <span className="text-base-content/70">群组发证状态:</span>
          {isMemberInGroup ? (
            <span className="badge badge-success text-white font-semibold">该身份已在群组中</span>
          ) : (
            <span className="badge badge-warning font-semibold">未发证 (待上链)</span>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center text-xs">
        <span className="text-base-content/70">发证机构地址 (Issuer):</span>
        <span className="font-mono font-bold">
          {issuerAddress
            ? `${(issuerAddress as string).slice(0, 10)}…${(issuerAddress as string).slice(-6)}`
            : "加载中..."}
        </span>
      </div>

      {!isMemberInGroup && (
        <div className={`alert text-xs py-2 shadow-sm ${isIssuerWallet ? "alert-success" : "alert-info"}`}>
          {isIssuerWallet ? (
            <span>当前钱包即为发证机构，可直接为本 Commitment 发证上链。</span>
          ) : demoIssuerEnabled ? (
            <span>
              当前钱包不是发证机构。合约仅允许 Issuer 发证，可点击下方「演示机构发证」由服务端 Demo Issuer
              代为上链（私钥不进入浏览器，测试网演示专用）。
            </span>
          ) : (
            <span>
              当前钱包不是发证机构（Issuer），合约会拒绝自行发证。请改用发证机构钱包，或让演示方为你的 Commitment
              发证后再回到 Tab 1 生成证明。
            </span>
          )}
        </div>
      )}

      <button
        className="btn btn-primary w-full"
        onClick={onIssueCredential}
        disabled={groupId === undefined || isIssuing || isMemberInGroup || !hasIdentity || !isIssuerWallet}
      >
        {isIssuing ? (
          <>
            <span className="loading loading-spinner"></span> 正在上链发证中 (等待交易确认)...
          </>
        ) : isMemberInGroup ? (
          "该身份已完成发证入群 (无需重复操作)"
        ) : !isIssuerWallet ? (
          "当前钱包非发证机构 (Issuer)"
        ) : (
          "审核 KYC 并发证上链 (Add to Semaphore Group)"
        )}
      </button>

      {demoIssuerEnabled && !isMemberInGroup && hasIdentity && (
        <button className="btn btn-outline btn-secondary w-full" onClick={onDemoIssue} disabled={isDemoIssuing}>
          {isDemoIssuing ? (
            <>
              <span className="loading loading-spinner"></span> 演示机构发证中（等待链上确认）...
            </>
          ) : (
            "演示机构发证（Demo Issuer / 测试网专用）"
          )}
        </button>
      )}

      {isMemberInGroup && (
        <div className="flex justify-end">
          <button className="btn btn-secondary btn-sm" onClick={onGoToUser}>
            返回 Tab 1 生成零知识证明
          </button>
        </div>
      )}

      <p className="text-xs opacity-60 text-center">
        * 在完整商业流程中，此步由 Chainlink CRE 自动化工作流与合规机构私钥授权执行。
      </p>
    </div>
  );
};
