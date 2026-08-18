# ZK-CID 黑客松参赛视频 · 总脚本 (Master Script)

- **目标时长**: 3 分 30 秒
- **语言**: 英文旁白（面向全球评委）+ 中文字幕（可选用）
- **线上素材**: https://web-3-0-decentralized.vercel.app
- **代码仓库**: https://github.com/juangh123/WEB-3.0-Decentralized
- **赛事**: BLI Legal Tech Hackathon Edition 2 — Law / Finance / Compliance（附加 Chainlink CRE 赏金）
- **成片规格**: 1920x1080 (16:9), 30fps, H.264 + AAC

---

## 一、总览表

| # | 段落 | 时间 | 画面核心 | 目的 |
|---|------|------|----------|------|
| 1 | Hook 合规悖论 | 0:00–0:15 | 分屏: 隐私 vs 监管 碰撞 | 3 秒抓住注意力 |
| 2 | Problem 双重信任困境 | 0:15–0:40 | 数据泄露 / 制裁名单更新慢 | 痛点放大 |
| 3 | Solution 方案 | 0:40–1:10 | ZK-CID 概念 + 夜店比喻 | 一句话讲清 |
| 4 | Demo 实机演示 | 1:10–2:15 | 四步全流程录屏 | 眼见为实 |
| 5 | Architecture 技术栈 | 2:15–2:40 | 架构图 + CRE 亮点 | 技术深度 |
| 6 | Impact 商业影响 | 2:40–3:10 | 生态接入场景 | 价值升华 |
| 7 | Close 结尾 | 3:10–3:30 | 链接 + 致谢 | 行动号召 |

---

## 二、逐段脚本

### S1 · Hook（0:00–0:15）

**画面**: 深色科技感背景，左右分屏。左屏 "Traditional KYC = Full Exposure"，右屏 "Anonymous DeFi = Illegal"。两屏向中间碰撞并碎裂，浮现标题 "The Compliance Paradox"。

**英文旁白**:
> Web3 has a compliance paradox. Traditional KYC makes you hand over your passport, your face, your home address — to databases that get hacked every week. But fully anonymous DeFi? That gets shut down by regulators. So today, you have to choose: expose your privacy, or break the law.

**中文字幕**:
> Web3 有一个合规悖论。传统 KYC 要求你交出护照、人脸、家庭住址——存进每周都会被黑的数据库。而完全匿名的 DeFi？会被监管者直接关停。所以你只能在「暴露隐私」和「违法」之间二选一。

---

### S2 · Problem（0:15–0:40）

**画面**: 左侧新闻头条风格卡片叠放（数据泄露、GDPR 罚款、交易所关停）；右侧一张 "OFAC Sanctions List" 名单滚动，光标手动删除一条记录，旁边一个大大的 "3 DAYS" 计时器。

**英文旁白**:
> And that's not the only problem. Compliance isn't static. When someone lands on an OFAC sanctions list, revoking their access can take days — because it depends on manual, centralized updates. One point of failure. One too many. ZK-CID fixes both halves of this broken system.

**中文字幕**:
> 而且问题不止于此。合规状态不是一成不变的——当有人被列入 OFAC 制裁名单，撤销其访问权限可能要花好几天，因为整个过程依赖人工和中心化更新。一个单点故障，就毁掉整个系统。ZK-CID 同时修复了这个破碎系统的两半。

---

### S3 · Solution（0:40–1:10）

**画面**: 品牌片头卡 "ZK-CID — Zero-Knowledge Compliant Identity"。锁形图标逐渐变成绿色对勾。下方滚动三个关键词: Decentralized Identity · Zero-Knowledge Proofs · Automated Revocation。

**英文旁白**:
> ZK-CID: Zero-Knowledge Compliant Identity. We combine Decentralized Identity with Zero-Knowledge Proofs, so you can prove "I am compliant" — without ever revealing "who I am." Think of a nightclub: the bouncer knows you're over twenty-one. They just don't know your name, your birthday, or your ID number. That's what we built for DeFi.

**中文字幕**:
> ZK-CID——零知识合规身份。我们把去中心化身份与零知识证明结合，让你能证明「我是合规的」，却永远不必透露「我是谁」。就像夜店门口的保安：他知道你年满 21 岁，却不知道你的姓名、生日或证件号。这就是我们为 DeFi 建造的东西。

---

### S4 · Demo（1:10–2:15）⭐ 全场核心

**画面**: 全屏录屏（本地端到端演示，见下方《录屏操作卡》）。

**英文旁白**:
> Let's see it live. First, I generate an anonymous identity right here in the browser — my private key never leaves this device. Second, a trusted issuer verifies my documents off-chain, then adds my anonymous commitment to an on-chain Semaphore group. Now for the magic: I want into a regulated DeFi app, so I generate a Zero-Knowledge Proof right in the browser. The math proves two things: I'm in the approved group, and I've never used this proof before. I submit it on-chain; the contract verifies it and mints my Access NFT. I'm in — and the protocol never learned my identity. And here's the part judges love: when a user hits a sanctions list, our Chainlink CRE workflow revokes their credential on-chain automatically — no humans, no delay. Watch: the revoked user tries to mint again — and gets rejected. Credential revoked. Done.

**中文字幕**:
> 让我们现场演示。第一步，我在浏览器里生成一个匿名身份——私钥绝不离端。第二步，受信任的签发机构在链下核验我的证件，然后把我的匿名承诺加入链上的 Semaphore 群组。接下来是魔法时刻：我想进入一个受监管的 DeFi 应用，于是在浏览器里生成零知识证明——数学上证明两件事：我属于批准名单，且这个证明从未被用过。提交上链，合约验证通过，铸造我的 Access NFT——成功进入，而协议自始至终不知道我的身份。评委最爱的是这个：当用户命中制裁名单，我们的 Chainlink CRE 工作流会自动在链上撤销他的凭证——没有人工、没有延迟。看，被撤销的用户再次铸造——被拒绝。撤销完成。

---

### S5 · Architecture（2:15–2:40）

**画面**: 架构图（Issuer → Semaphore Group → ComplianceGate → AccessNFT → DeFi），下方一排技术徽标: Solidity · Semaphore v4 · Hardhat · Next.js · Chainlink CRE。

**英文旁白**:
> Under the hood: Semaphore v4 for anonymous signaling, Solidity contracts on Hardhat, a Next.js frontend built on Scaffold-ETH 2 — and Chainlink CRE for fully automated compliance lifecycle management. Every step is auditable on-chain, while user privacy stays mathematically protected.

**中文字幕**:
> 底层架构：Semaphore v4 负责匿名信号，Solidity 合约跑在 Hardhat 上，Next.js 前端基于 Scaffold-ETH 2——再加上 Chainlink CRE 实现全自动的合规生命周期管理。每一步都在链上可审计，而用户隐私始终受到数学的保护。

---

### S6 · Impact（2:40–3:10）

**画面**: 生态图——DEX、借贷协议、RWA 平台像积木一样接入一个 "ZK-CID Gate" 模块；底部出现三行结论: "Regulators: verifiable compliance" / "Protocols: zero data custody risk" / "Users: absolute privacy"。

**英文旁白**:
> What does this unlock? Any DeFi protocol — a DEX, a lending platform — can plug into our gate and become regulatory-ready in a day. They never touch user data, so they never own the legal risk. Regulators get verifiable compliance. Users get absolute privacy. Everybody wins. This isn't just a hackathon project — it's the infrastructure compliant Web3 has been waiting for.

**中文字幕**:
> 这解锁了什么？任何 DeFi 协议——DEX、借贷平台——只需接入我们的门控，一天内就能变成监管就绪。它们从不接触用户数据，因此从不承担法律风险。监管方得到可验证的合规，用户得到绝对的隐私。各方共赢。这不只是一个黑客松项目——这是合规 Web3 一直在等待的基础设施。

---

### S7 · Close（3:10–3:30）

**画面**: 品牌片尾卡。大标题 "Try ZK-CID"，下方两行: live demo 链接 + GitHub 链接；底部 "BLI Legal Tech Hackathon Edition 2 · Law / Finance / Compliance"。

**英文旁白**:
> Try it yourself: the live demo is live at web-3-0-decentralized.vercel.app, and the code is open source on GitHub. I'm a solo developer building the trust layer for the next generation of DeFi. Thank you — and let's build a compliant, private Web3 together.

**中文字幕**:
> 欢迎亲自体验：线上演示在 web-3-0-decentralized.vercel.app，代码已在 GitHub 开源。我是一名独立开发者，正在为下一代 DeFi 构建信任层。谢谢——让我们一起建设一个既合规又私密的 Web3。

---

## 三、录屏操作卡（S4 实机演示）

> 建议使用 **OBS Studio**（免费）录制 1920x1080 / 30fps。旁白可同时录，也可后期补录（我们已备好中英字幕 SRT）。

**准备（约 3 分钟）**：
1. 终端 1: `yarn chain`（启动本地 Hardhat 链）
2. 终端 2: `yarn deploy`（部署合约并生成前端 ABI）
3. 终端 3: `cd mock-api && npm start`（启动模拟制裁名单 API）
4. 终端 4: `yarn start`（启动前端 http://localhost:3000）

**录制步骤**（每步留 1–2 秒停顿，方便剪辑）：

| 步骤 | 操作 | 对应旁白 |
|------|------|----------|
| 3a | 打开 `http://localhost:3000/zk-cid` 落地页 | "Let's see it live…" |
| 3b | 点击「生成身份」，展示本地生成的 Semaphore 身份（私钥不显示在画面中） | "First, I generate an anonymous identity…" |
| 3c | 切换到 `/issuer`（或 Issuer 面板），演示机构核验并「发放凭证」，展示 Commitment 上链成功 | "Second, a trusted issuer…" |
| 3d | 切换到用户视角，点击「生成 ZK 证明」 | "I generate a Zero-Knowledge Proof…" |
| 3e | 提交证明 → 展示 AccessNFT Mint 成功的交易哈希 | "The contract verifies it and mints my Access NFT…" |
| 3f | 打开 mock-api 制裁名单，添加当前用户地址 → 观察 CRE 工作流自动触发撤销 | "when a user hits a sanctions list…" |
| 3g | 再次尝试 Mint，展示被 revert（`Credential revoked`） | "the revoked user tries again — and gets rejected…" |

**文件命名**: 将录好的片段保存到 `video-production/footage/`，按顺序命名 `clip-01.mp4` … `clip-07.mp4`（允许缺省，成片脚本会按存在性自动拼接）。

---

## 四、备选方案：纯线上站快速版（不跑本地链）

如果时间紧张，可只录 Vercel 线上站 + 静态截图：
1. 打开 https://web-3-0-decentralized.vercel.app 落地页（对应 3a）
2. 进入 `/demo` 隐私对比页（对应 3b–3e 的视觉素材，用截图平移代替实机）
3. 进入 `/zk-test` ZK 引擎测试页（展示证明验证过程）
4. 口播说明「完整链上流程见代码仓库测试记录」（对应 3f–3g）

此方案约 1 分钟，适合做预告片；主提交仍建议用完整版。
