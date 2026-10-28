# Recording the CRE simulation clip (60–90 seconds)

The pitch video predates the CRE CLI evidence. This short clip shows Chainlink judges the
workflow running under the official CLI, which is the bounty's hard requirement. Record it
on the Windows machine that has the CRE CLI and `cre login` set up.

## Before recording

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized"
git pull                                  # get the issuance trigger and the updated script
cd zk-cid
yarn install                              # Next.js 16.4.2 and the lockfile changed
cd workflows
.\run-cre-simulate.ps1 -BuildOnly         # warm-up: mirror + build, no credentials needed
```

If the CLI asks for credentials, run `cre login` once (or set `CRE_API_KEY`).

## What to record (terminal + browser, one take)

| Time | Show | Say (suggested) |
| --- | --- | --- |
| 0:00–0:10 | `core.ts`, the two `cre.handler(...)` lines in `initWorkflow` | "One CRE workflow, two triggers: a cron that re-screens every member, and an EVM log trigger that screens each credential the moment it is issued." |
| 0:10–0:35 | `.\run-cre-simulate.ps1 -SkipBuild` scrolling to `{"status": "revoked"...}` | "The official CRE CLI simulates the cron handler against live Sepolia: DON-consensus fetch of the sanctions feed, on-chain reads, Semaphore tree rebuild, and the revoke report." |
| 0:35–0:60 | `.\run-cre-simulate.ps1 -SkipBuild -Trigger issuance` | "Now the issuance trigger replays a real UserAdded log from Sepolia. The new commitment is on the sanctions list, so the workflow revokes it immediately." |
| 0:60–0:80 | Blockscout: tx `0xb64c050e…` and the verified `ComplianceGateReceiver` | "And this is a real on-chain revocation produced by the workflow's report, delivered through the receiver contract that only trusts the Keystone forwarder." |

Expected issuance-run output: `trigger=issuance`, `issuance screening ... result=sanctioned`,
and a final result with `"status": "revoked"` and `"trigger": "issuance"`. It is a dry run, so
`txHashes` holds an empty or zero hash.

## After recording

1. The two runs write `evidence/cre-simulate-<timestamp>.log` and
   `evidence/cre-simulate-issuance-<timestamp>.log`. Commit both.
2. In `workflows/compliance-lifecycle/evidence/README.md`, change the issuance row of the
   "At a glance" table to ✅ and link the new log.
3. Export the clip as 1080p MP4, put it in `packages/nextjs/public/demo/zk-cid-cre-simulation.mp4`
   (keep it under ~10 MB), push, and add the live link to the BUIDL page under
   "CHAINLINK CRE WORKFLOW".

If the issuance run fails, keep the cron clip alone; the cron simulation and the broadcast
transaction already meet the bounty requirement.
