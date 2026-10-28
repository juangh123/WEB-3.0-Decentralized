# ZK-CID Regulatory Mapping

This note maps ZK-CID's technical design to common legal and regulatory
questions raised by privacy-preserving KYC systems. It is a technical mapping,
not legal advice. Deployers should obtain jurisdiction-specific counsel before
production use.

## Summary

ZK-CID separates three roles that are usually bundled together:

- The **issuer** performs KYC/AML checks and remains the accountable regulated
  entity for those checks.
- The **user** proves membership in an approved set without revealing identity.
- The **verifier / DeFi protocol** checks a zero-knowledge proof and an
  on-chain revocation status.

Only a Semaphore commitment and proof nullifier are written on-chain. Names,
documents, wallet-to-identity links, and screening records stay with the
issuer's off-chain system.

## Requirement Mapping

| Area | Typical requirement or question | How ZK-CID addresses it | Remaining gap / owner |
| --- | --- | --- | --- |
| GDPR Art. 5(1)(c), data minimisation | Collect only data that is adequate, relevant, and limited to what is necessary | On-chain state contains only a pseudonymous commitment and nullifier; no name, document, or wallet-to-identity link. | The issuer must still enforce retention limits and deletion for off-chain KYC records. |
| GDPR Art. 25, privacy by design and by default | Use technical and organisational measures that protect data by design | Identity and proof are generated client-side; the private key stays in the browser. The verifier receives a proof, not the identity. | Hosting integrity, dependency pinning, and CSP review remain deployment responsibilities. |
| GDPR Art. 4(5), pseudonymisation | Reduce linkability of personal data | The commitment is a pseudonymous identifier; it does not encode PII. | Reusing one commitment across business domains increases correlation risk. Per-domain scopes are the roadmap. |
| GDPR Art. 17, erasure | Erase personal data on request | PII stays off-chain and can be erased by the issuer. On-chain membership can be revoked. | On-chain immutability must be assessed by counsel. Document the lawful basis, retention schedule, and erasure limits before production. |
| OFAC / EU sanctions screening | Screen customers and counterparties at onboarding, and keep screening current | A Chainlink CRE workflow screens at two moments: when a credential is issued (EVM log trigger on `UserAdded`) and on a schedule for every member (cron). Listed commitments are removed from the on-chain group through a DON-signed report. | The current list is a mock. Production needs an authoritative, versioned feed, an audit trail, and human review for false positives. |
| GDPR Art. 8 and COPPA, children's data; UK Online Safety Act and similar age-assurance duties | Services must know whether a user is a child (or an adult) without collecting more personal data than needed, and must not build profiles of minors | The same primitive works as a privacy-preserving age gate: an issuer that has checked a user's age adds the commitment to an "over 18" (or "under 16 with parental consent") group, and the service verifies a proof of membership. The service never receives a birth date, ID document or name, and proofs are unlinkable across services when each service uses its own scope. | Not implemented in this demo, which runs one compliance group. Production needs separate groups or scopes per attribute, an issuer accredited for age checks, re-verification rules, and a parental-consent flow where the law requires one. |
| FATF Recommendation 16 (Travel Rule) | Exchange originator and beneficiary information for covered virtual-asset transfers | ZK-CID is complementary: it can prove that a counterparty is compliance-approved without transmitting PII. | ZK-CID does not replace a Travel Rule data exchange. VASPs still need a Travel Rule provider and data-sharing agreements. |
| MiCA (EU) CASP obligations | CASPs must maintain AML/CFT policies, controls, and reporting | ZK-CID can act as a privacy-preserving credential and gate layer inside a CASP's onboarding and ongoing-monitoring programme. | ZK-CID is not a CASP and does not provide a licence. The CASP remains responsible for its AML programme and regulatory reporting. |
| eIDAS 2.0 / EUDI Wallet | Trusted digital identity and verifiable credentials | Issuer attestations can be modelled as verifiable credentials, while the Semaphore proof hides the underlying identity. | No EUDI integration yet. A production version needs a trusted issuer registry and a credential schema aligned with the chosen framework. |
| Revocation fairness / due process | A false positive must be appealable and reversible | `AccessNFT.revokeAccess` and `restoreAccess` support revocation and restoration; re-issuance can restore on-chain membership after review. | Add a documented appeal SLA, an operator review queue, and revocation reason codes. |
| Auditability and supervisory review | Regulators need evidence of who was screened, when, and with which list version | On-chain events, CRE run logs, and issuer records form the evidence chain; nullifiers prevent proof replay. | Add tamper-evident log retention and periodic reconciliation reports. |

## Design Boundaries

- **Pseudonymous is not automatically anonymous.** A commitment can become
  identifying if an issuer, verifier, or observer links it to off-chain
  records. The issuer must treat the commitment as personal data where the law
  requires it.
- **The issuer remains accountable.** ZK-CID does not transfer KYC/AML
  responsibility from the issuer to the protocol.
- **Sanctions data must be authoritative.** The bundled mock API is a demo
  fixture. Production screening needs a licensed data source, list versioning,
  and an auditable false-positive process.
- **Revocation needs a restoration path.** Automated revocation should be
  paired with operator review and `restoreAccess` so that an incorrect match
  does not permanently exclude a legitimate user.
- **Privacy does not remove record-keeping duties.** The design minimises
  on-chain data; it does not eliminate the issuer's regulatory record-keeping.

## Suggested Demo Talking Points

1. The chain never receives the user's identity, only a commitment.
2. The verifier can check compliance without contacting the issuer in real
   time.
3. Sanctions changes propagate through a CRE workflow, and revocation is
   observable on-chain.
4. The same design keeps an appeal and restoration path instead of treating
   every automated match as final.
5. The pattern generalises beyond sanctions: an age-assurance group lets a
   service keep minors out (or apply child protections) without ever storing a
   minor's personal data.
