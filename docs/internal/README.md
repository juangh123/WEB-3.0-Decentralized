# Internal working notes

These files are the team's own working notes, kept in the repository for transparency. They
are written in Chinese and several are historical snapshots; the English documents in
[`zk-cid/`](../../zk-cid/README.md) describe the current state.

| File | What it is |
| --- | --- |
| `zk-cid-code-audit-2026-10-10.md` | Full code and deployment audit (2026-10-10) plus two rounds of fixes |
| `zk-cid-audit-report.md` | Earlier audit (2026-07-18), superseded by the one above |
| `plan.md` | Early remediation plan, superseded |
| `zk-cid-completion-report.md` | Completion snapshot from 2026-07-26 with a 2026-10-03 update |
| `optimization_plan_20260730.md` | Optimisation plan from 2026-07-30 |
| `demo-recording-report-2026-07.md` | July demo-recording notes with local Anvil evidence (historical) |

## Audit summary (English)

The 2026-10-10 audit reviewed the contracts, frontend, CRE workflow, mock API, CI and the live
Sepolia deployment. It reported 7 high, 17 medium and 10 low-severity findings. The main
outcomes:

| ID | Finding | Status |
| --- | --- | --- |
| H1 | The live gate ran with `demoMode = true`, so proofs were not verified on-chain | Fixed: strict mode by default; live gate switched with tx `0xaab09625…ca2f` |
| H2 | The frontend rebuilt the Merkle tree from compact members instead of stable leaves | Fixed: proofs use `getLeaves()`; regression test pins the on-chain root |
| H3 | CRE batch revocation reused stale Merkle proofs and reported failures as success | Fixed: state is re-read between writes; failures return `partial` / `failed` |
| H4 | The CRE receiver accepted reports from any workflow behind the forwarder | Mitigated: deployment script refuses unpinned receivers; pinning the live receiver waits for the DON owner address |
| H5 | Revoking a credential left already minted AccessNFTs valid | Partly fixed: AccessNFT v2 adds `revokeAccess` / `restoreAccess` / `isValid` and blocks transfers from revoked accounts; automatic propagation is a documented limitation |
| H6 | Critical and high dependency advisories | Fixed, with an audit gate in CI (re-applied on 2026-10-27 for the Next.js 16.4.0 advisories) |
| H7 | Demo issuer key exposed to the browser | Fixed: issuance runs server-side behind `/api/demo-issue`; key rotation is a manual step |

Medium and low findings (input validation of the sanctions feed, mock API authentication and
CORS, Hardhat network key fallbacks, build settings, test coverage, address consistency, and
others) are listed with their fixes in sections 10 and 11 of the audit.
