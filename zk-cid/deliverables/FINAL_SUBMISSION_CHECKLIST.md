# ZK-CID Final Submission Checklist

Deadline: **2026-11-01 01:01 UTC = 2026-11-01 09:01 Beijing time.** Aim to finish by the
evening of 2026-10-31 (Beijing); BUIDL edits are likely locked after the deadline.

Status as of 2026-10-27. Items marked "you" need the account owner (wallet, DoraHacks login,
CRE CLI credentials or a screen recording).

## 1. Code and repository (final sprint, 2026-10-27)

- [x] CRE workflow: second handler (EVM log trigger on `UserAdded`, FINALIZED) for screening at
      issuance; cron path unchanged; compiles to CRE WASM
- [x] CRE TestRuntime simulation: 11 workflow tests + 3 Poseidon vectors pass
- [x] Frontend: gas-free verification (eth_call of `AccessNFT.mint`) and proof generation without
      a wallet; verified against live Sepolia with the 2026-10-17 strict-mode proof
- [x] Frontend: CRE panel explains why the seeded sanctioned member is still in the group, with
      links to the CLI log and the broadcast revocation
- [x] Security: Next.js 16.4.0 → 16.4.2 (two critical RCE advisories and one high DoS advisory
      on 16.4.0); unused direct `zod@3` removed from the Hardhat package; both audit gates clean
- [x] Judge-facing docs in English: `zk-cid/README.md`, evidence README, mock API README,
      workflow comments (Chinese copies kept as `*.zh-CN.md`)
- [x] Internal Chinese notes moved to `docs/internal/` with an English audit summary
- [x] New logo, cover, social preview, favicon, 10-slide pitch deck, architecture diagram
- [x] `LEGAL_MAPPING.md`: age assurance / minors' data row (matches the track description)
- [x] Dependabot version updates paused during judging (restore `open-pull-requests-limit: 5` afterwards)
- [x] Local gates: contracts 34/34, frontend unit 12/12, E2E 7/7, CRE sim 14/14, mock API 13/13,
      lint, type checks, `next build`, `check:addresses`, both audits
- [ ] **you**: push the branch / merge to `main`, then confirm GitHub Actions is green
- [ ] **you**: confirm the Vercel production deployment picked up the new commit and
      `/zk-cid` shows "Check on Sepolia without gas"

## 2. Live environment

- [ ] **you**: top up the demo issuer `0x951c41D827d0A6F5b9ef4C44943E3Feb25E51348`
      (0.034 Sepolia ETH on 2026-10-27; aim for ≥ 0.2). Judges' "Demo issuer" clicks spend it,
      and judging can run weeks past the deadline.
- [ ] **you**: run the full judge path once on production without a wallet
      (identity → demo issuer → proof → "Verify proof without gas" shows "Accepted on-chain")
- [x] Mock API returns the seeded commitment; `/api/sanctions` proxy works on production
- [x] Sepolia: strict mode, members/leaves consistent with the docs, contracts verified

## 3. CRE evidence

- [x] Official CLI build + cron `simulate` log (2026-10-02)
- [x] Real broadcast revocation tx `0xb64c050e…` (2026-10-02)
- [ ] **you**: run `.\run-cre-simulate.ps1` and `.\run-cre-simulate.ps1 -Trigger issuance`,
      commit both logs, and mark the issuance row ✅ in the evidence README
- [ ] **you** (optional, high value): record the 60–90 s CLI clip, see `CRE_RECORDING_GUIDE.md`
- [ ] Optional business step: Chainlink onboarding call + MNDA, then
      `cre workflow deploy compliance-lifecycle -T production-settings`

## 4. DoraHacks BUIDL page (https://dorahacks.io/buidl/48603)

- [ ] **you**: upload the new logo `media/zk-cid-logo-512.png`
- [ ] **you**: upload the new cover `media/submission-cover.png`
- [ ] **you**: replace the description with the Details section of `DORA_SUBMISSION.md`
- [ ] **you**: attach or link `media/ZK-CID-Pitch-Deck.pdf`
- [ ] **you**: confirm the Chainlink CRE bounty is still ticked; reload the public page and check it
- [x] Track: `All BUIDLs`; RYO-CHAN agents bounty not ticked

## 5. Hygiene

- [x] No `.env`, private keys or tokens tracked
- [ ] **you**: rotate or encrypt the issuer key in `packages/hardhat/.env` after judging
      (plaintext on disk, never committed)
- [ ] After judging: restore Dependabot, consider pinning the receiver
      (`setExpectedAuthor` / `setExpectedWorkflowName`) once the DON owner address exists
