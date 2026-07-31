import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

// Demo commitments / nullifiers (field elements, arbitrary for the mock).
const COMMITMENT_1 = 1111111111111111111111111111111111111111111111111111111111111111n;
const COMMITMENT_2 = 2222222222222222222222222222222222222222222222222222222222222222n;
const NULLIFIER_1 = 3333333333333333333333333333333333333333333333333333333333333333n;
const NULLIFIER_2 = 4444444444444444444444444444444444444444444444444444444444444444n;

function makeProof(nullifier: bigint, merkleTreeRoot: bigint) {
  return {
    merkleTreeDepth: 1,
    merkleTreeRoot,
    nullifier,
    message: 0n,
    scope: 0n,
    points: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n],
  };
}

describe("ComplianceGate and AccessNFT", function () {
  let mockSemaphore: any;
  let gate: any;
  let nft: any;
  let issuer: any;
  let workflow: any;
  let user1: any;
  let user2: any;
  let attacker: any;

  beforeEach(async function () {
    [issuer, workflow, user1, user2, attacker] = await ethers.getSigners();

    const MockSemaphore = await ethers.getContractFactory("MockSemaphore");
    mockSemaphore = await MockSemaphore.deploy();

    const ComplianceGate = await ethers.getContractFactory("ComplianceGate");
    gate = await ComplianceGate.deploy(await mockSemaphore.getAddress());

    const AccessNFT = await ethers.getContractFactory("AccessNFT");
    nft = await AccessNFT.deploy(await gate.getAddress());

    await gate.setVerifier(await nft.getAddress(), true);
  });

  describe("deployment", function () {
    it("sets issuer, groupId, demoMode and registers the NFT as verifier", async function () {
      expect(await gate.issuer()).to.equal(issuer.address);
      expect(await gate.groupId()).to.equal(1n); // first group created on the mock
      expect(await gate.demoMode()).to.equal(true);
      expect(await gate.verifiers(await nft.getAddress())).to.equal(true);
    });
  });

  describe("access control", function () {
    it("reverts when an unauthorized address calls issueCredential", async function () {
      await expect(gate.connect(attacker).issueCredential(COMMITMENT_1)).to.be.revertedWith("Not authorized");
    });

    it("reverts when an unauthorized address calls revokeCredential", async function () {
      await gate.issueCredential(COMMITMENT_1);
      await expect(gate.connect(attacker).revokeCredential(COMMITMENT_1, [])).to.be.revertedWith("Not authorized");
    });

    it("allows the registered CRE workflow to issue and revoke", async function () {
      await expect(gate.setWorkflow(workflow.address)).to.emit(gate, "WorkflowUpdated").withArgs(workflow.address);
      await expect(gate.connect(workflow).issueCredential(COMMITMENT_1)).to.emit(gate, "UserAdded");
      await expect(gate.connect(workflow).revokeCredential(COMMITMENT_1, [])).to.emit(gate, "CredentialRevoked");
    });

    it("restricts admin setters to the issuer", async function () {
      await expect(gate.connect(attacker).setWorkflow(attacker.address)).to.be.revertedWith("Not issuer");
      await expect(gate.connect(attacker).setAccessNFT(attacker.address)).to.be.revertedWith("Not issuer");
      await expect(gate.connect(attacker).setDemoMode(false)).to.be.revertedWith("Not issuer");
    });

    it("blocks direct EOA calls to verifyCompliance (anti front-running)", async function () {
      await gate.issueCredential(COMMITMENT_1);
      await expect(gate.connect(attacker).verifyCompliance(makeProof(NULLIFIER_1, COMMITMENT_1))).to.be.revertedWith(
        "Not a verifier",
      );
    });
  });

  describe("credential issuance", function () {
    it("reverts on duplicate issuance of the same commitment", async function () {
      await gate.issueCredential(COMMITMENT_1);
      await expect(gate.issueCredential(COMMITMENT_1)).to.be.revertedWith("Already issued");
    });
  });

  describe("demo mode happy path", function () {
    it("issues a credential, verifies the proof and mints the NFT", async function () {
      await gate.issueCredential(COMMITMENT_1);
      expect(await gate.getMembers()).to.deep.equal([COMMITMENT_1]);

      const tx = nft.connect(user1).mint(makeProof(NULLIFIER_1, COMMITMENT_1));
      await expect(tx).to.emit(gate, "ComplianceVerified").withArgs(NULLIFIER_1);
      expect(await nft.balanceOf(user1.address)).to.equal(1n);
      expect(await nft.ownerOf(0n)).to.equal(user1.address);
      expect(await gate.verifiedNullifiers(NULLIFIER_1)).to.equal(true);
    });

    it("reverts when the same nullifier is verified twice", async function () {
      await gate.issueCredential(COMMITMENT_1);
      await nft.connect(user1).mint(makeProof(NULLIFIER_1, COMMITMENT_1));
      await expect(nft.connect(user2).mint(makeProof(NULLIFIER_1, COMMITMENT_1))).to.be.revertedWith(
        "Proof already used",
      );
    });

    it("reverts when the same address mints twice", async function () {
      await gate.issueCredential(COMMITMENT_1);
      await nft.connect(user1).mint(makeProof(NULLIFIER_1, COMMITMENT_1));
      await expect(nft.connect(user1).mint(makeProof(NULLIFIER_2, COMMITMENT_1))).to.be.revertedWith("Already minted");
    });
  });

  describe("revocation", function () {
    it("blocks verification of a revoked credential and rejects double revocation", async function () {
      await gate.issueCredential(COMMITMENT_1);
      await gate.revokeCredential(COMMITMENT_1, []);

      expect(await gate.hasBeenRevoked(COMMITMENT_1)).to.equal(true);
      expect(await gate.getMembers()).to.deep.equal([]);

      // The demo group is a single-member tree, so proof.merkleTreeRoot == commitment.
      await expect(nft.connect(user1).mint(makeProof(NULLIFIER_1, COMMITMENT_1))).to.be.revertedWith(
        "Credential revoked",
      );

      await expect(gate.revokeCredential(COMMITMENT_1, [])).to.be.revertedWith("Already revoked");
    });

    it("reverts when revoking a credential that was never issued", async function () {
      await expect(gate.revokeCredential(COMMITMENT_2, [])).to.be.revertedWith("Unknown credential");
    });

    it("allows re-issuance after revocation to clear the ban", async function () {
      await gate.issueCredential(COMMITMENT_1);
      await gate.revokeCredential(COMMITMENT_1, []);
      await gate.issueCredential(COMMITMENT_1);

      expect(await gate.hasBeenRevoked(COMMITMENT_1)).to.equal(false);
      await nft.connect(user1).mint(makeProof(NULLIFIER_1, COMMITMENT_1));
      expect(await nft.balanceOf(user1.address)).to.equal(1n);
    });
  });

  describe("O(1) member removal", function () {
    it("handles single-member revocation (edge case: only element)", async function () {
      await gate.issueCredential(COMMITMENT_1);
      await gate.revokeCredential(COMMITMENT_1, []);
      expect(await gate.getMembers()).to.deep.equal([]);
      expect(await gate.isMember(COMMITMENT_1)).to.equal(false);
    });

    it("handles first-member revocation (edge case: idx == 0)", async function () {
      await gate.issueCredential(COMMITMENT_1);
      await gate.issueCredential(COMMITMENT_2);
      // Revoke the first member
      await gate.revokeCredential(COMMITMENT_1, []);
      const members = await gate.getMembers();
      expect(members).to.deep.equal([COMMITMENT_2]);
      expect(await gate.isMember(COMMITMENT_1)).to.equal(false);
      expect(await gate.isMember(COMMITMENT_2)).to.equal(true);
    });

    it("handles last-member revocation (edge case: idx == lastIdx)", async function () {
      await gate.issueCredential(COMMITMENT_1);
      await gate.issueCredential(COMMITMENT_2);
      // Revoke the last member
      await gate.revokeCredential(COMMITMENT_2, []);
      const members = await gate.getMembers();
      expect(members).to.deep.equal([COMMITMENT_1]);
      expect(await gate.isMember(COMMITMENT_2)).to.equal(false);
      expect(await gate.isMember(COMMITMENT_1)).to.equal(true);
    });
  });

  describe("verifier management", function () {
    it("allows issuer to add and remove verifiers", async function () {
      await gate.setVerifier(attacker.address, true);
      expect(await gate.verifiers(attacker.address)).to.equal(true);
      await gate.setVerifier(attacker.address, false);
      expect(await gate.verifiers(attacker.address)).to.equal(false);
    });

    it("blocks non-issuer from managing verifiers", async function () {
      await expect(gate.connect(attacker).setVerifier(attacker.address, true)).to.be.revertedWith("Not issuer");
    });
  });

  describe("strict mode (demoMode = false)", function () {
    it("reverts on an invalid proof", async function () {
      await gate.setDemoMode(false);
      expect(await gate.demoMode()).to.equal(false);

      await gate.issueCredential(COMMITMENT_1);
      await mockSemaphore.setValidationResult(false); // simulate an invalid ZK proof

      await expect(nft.connect(user1).mint(makeProof(NULLIFIER_1, COMMITMENT_1))).to.be.revertedWithCustomError(
        mockSemaphore,
        "Semaphore__InvalidProof",
      );

      // The failed verification must not burn the nullifier.
      expect(await gate.verifiedNullifiers(NULLIFIER_1)).to.equal(false);
    });

    it("accepts a valid proof", async function () {
      await gate.setDemoMode(false);
      await gate.issueCredential(COMMITMENT_1);

      await nft.connect(user1).mint(makeProof(NULLIFIER_1, COMMITMENT_1));
      expect(await nft.balanceOf(user1.address)).to.equal(1n);
    });
  });
});
