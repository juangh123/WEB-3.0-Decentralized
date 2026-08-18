# Sepolia Real-Environment Deployment

This document records the live Sepolia deployment and the exact commands used to reproduce it.

## Deployed Contracts

| Contract | Address | Deployment Transaction |
| --- | --- | --- |
| ComplianceGate | `0xB393C4Aace43162b170d4f6A84a60fA1AF9D1Ef3` | `0xb642852e5c449fbb9729cc24b50e04488568127161a198c8a97e1465c0744700` |
| AccessNFT | `0xF0B9199CAeD03b5E0A5f9924f3B4171B56e70e64` | `0x24741c412a2403a7511cd382662f13ee72fc37e41eb5d6cf0393602dcc113846` |

External dependency:

| Dependency | Sepolia Address |
| --- | --- |
| Semaphore v4 | `0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D` |

Deployer:

`0x951c41D827d0A6F5b9ef4C44943E3Feb25E51348`

## Required Environment

Create `packages/hardhat/.env`:

```ini
ALCHEMY_API_KEY=your-alchemy-sepolia-key
DEPLOYER_PRIVATE_KEY=0x-your-funded-sepolia-private-key
ETHERSCAN_API_KEY=your-etherscan-key # optional, for verification
```

Never commit `.env` or the private key.

## Deploy

From the repository root:

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized\zk-cid\packages\hardhat"
.\node_modules\.bin\tsx.cmd scripts\deploySepolia.ts
```

From the root package after the script is configured:

```powershell
yarn.cmd deploy:sepolia
```

The script deploys `ComplianceGate` and `AccessNFT`, then calls:

- `setAccessNFT(AccessNFT)`
- `setVerifier(AccessNFT, true)`
- `setWorkflow(deployer)`

## Update Frontend Contract Data

After deployment:

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized\zk-cid\packages\hardhat"
.\node_modules\.bin\tsx.cmd scripts\generateTsAbis.ts
```

Then build the frontend:

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized\zk-cid"
yarn.cmd workspace @se-2/nextjs build
```

## Smoke Test Evidence

Reproduce the live smoke test with the issuer wallet:

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized\zk-cid\packages\hardhat"
$env:DEPLOYER_PRIVATE_KEY = "<issuer-private-key>"
.\node_modules\.bin\tsx.cmd scripts\sepoliaSmokeDemo.ts status
.\node_modules\.bin\tsx.cmd scripts\sepoliaSmokeDemo.ts issue
.\node_modules\.bin\tsx.cmd scripts\sepoliaSmokeDemo.ts revoke
```

| Step | Transaction |
| --- | --- |
| Issue credential | `0x68cbf4503e18e262f8273f002ee6d3d1d49e7885b99d4ba45de396621963fecc` |
| Mint AccessNFT | `0xe371783abbb0fe1b429cc900d524b5b24ef338e652591c5b7e92a013a98eef9c` |
| Revoke credential | `0x053cb12bc3bacb6d037ea246367a13da262ad72ab0f10a2178e7c8496105a21a` |

Current live demo state after re-issuing a fresh commitment:

- Commitment: `123456789012345678901234567890123456789`
- Issue credential tx: `0xf4e28de8931123e71e0e76fa8cff24f96a38ef3da8b691658c4461cd9f234682`

Verified state:

- `ComplianceGate.groupId = 625`
- `ComplianceGate.demoMode = true`
- `ComplianceGate.getMembers() = [123456789012345678901234567890123456789]`
- `AccessNFT.nextTokenId = 1`

## Publish Frontend

The Vercel frontend must be redeployed after `deployedContracts.ts` changes:

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized\zk-cid\packages\nextjs"
.\node_modules\.bin\vercel.cmd login
.\node_modules\.bin\vercel.cmd --prod
```

Vercel environment variables:

- `NEXT_PUBLIC_ALCHEMY_API_KEY`
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
- `YARN_ENABLE_IMMUTABLE_INSTALLS=false`
- `ENABLE_EXPERIMENTAL_COREPACK=1`

## Publish Mock API

The mock API is a separate Vercel project:

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized\zk-cid\mock-api"
.\node_modules\.bin\vercel.cmd login
.\node_modules\.bin\vercel.cmd link
.\node_modules\.bin\vercel.cmd --prod
```

Set `ADMIN_TOKEN` in that project and seed the smoke-test commitment:

```text
SEED_SANCTIONED=123456789012345678901234567890123456789
```

Then update the CRE workflow:

```powershell
$env:SANCTIONS_API_URL = "https://mock-api-topaz-zeta.vercel.app/api/sanctions-list"
$env:COMPLIANCE_GATE_ADDRESS = "0xB393C4Aace43162b170d4f6A84a60fA1AF9D1Ef3"
```

## Known Production Gaps

- `demoMode` remains `true`; strict Semaphore validation should only be enabled after real proof generation is wired into the frontend.
- `revokeCredential` currently receives empty `merkleProofSiblings`, so revocation is enforced by `hasBeenRevoked` rather than on-tree removal.
- `creWorkflow` is currently the deployer; update it to the CRE workflow address before production use.
- The live sanctions list must be seeded with the same commitment that is currently a member of the new `ComplianceGate` group; otherwise the CRE revocation demo has no intersection.
