"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldEventHistory, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useIdentity } from "~~/hooks/zk-cid/useIdentity";
import { useProof } from "~~/hooks/zk-cid/useProof";
import { notification } from "~~/utils/scaffold-eth";

export default function ZKCIDDemo() {
  const { address } = useAccount();
  const {
    identity,
    createIdentity,
    createDeterministicIdentity,
    clearIdentity,
    isLoading: isIdentityLoading,
  } = useIdentity();
  const { proof, generateZkProof, isGenerating, error: proofError } = useProof();

  const [activeTab, setActiveTab] = useState<"user" | "issuer" | "verifier">("user");

  // Read the Group ID from the Contract
  const { data: groupId } = useScaffoldReadContract({
    contractName: "ComplianceGate",
    functionName: "groupId",
  });

  const { data: userAddedEvents, isLoading: isEventsLoading } = useScaffoldEventHistory({
    contractName: "ComplianceGate",
    eventName: "UserAdded",
    fromBlock: 0n,
    watch: true,
  });

  const groupMembers = useMemo(() => {
    if (!userAddedEvents) return [];
    return userAddedEvents.map(event => event.args.commitment?.toString() ?? "");
  }, [userAddedEvents]);

  const { writeContractAsync: writeComplianceGate } = useScaffoldWriteContract({
    contractName: "ComplianceGate",
  });

  const { data: hasMinted } = useScaffoldReadContract({
    contractName: "AccessNFT",
    functionName: "hasMinted",
    args: [address],
  });

  const handleIssueCredential = async () => {
    if (!identity) return notification.error("Please create an identity in the User tab first (for demo purposes).");
    try {
      await writeComplianceGate({
        functionName: "issueCredential",
        args: [BigInt(identity.commitment.toString())],
      });
      notification.success("Credential Issued (User added to Group)!");
    } catch (e) {
      console.error(e);
      notification.error("Failed to issue credential.");
    }
  };

  const handleGenerateProof = async () => {
    if (!identity) return notification.error("No identity.");
    if (!address) return notification.error("Please connect your wallet first.");
    if (groupId === undefined) return notification.error("Contract Group ID not loaded.");

    if (groupMembers.length === 0) {
      return notification.error("No members in group yet. Ask Issuer to add your identity.");
    }

    try {
      await generateZkProof(identity, groupMembers, groupId, address);
      notification.success("ZK Proof Generated!");
    } catch {
      notification.error("Failed to generate proof. Are you in the group?");
    }
  };

  const { writeContractAsync: writeAccessNFT } = useScaffoldWriteContract({
    contractName: "AccessNFT",
  });

  const handleVerifyProof = async () => {
    if (!proof) return notification.error("No proof generated.");
    if (!address) return notification.error("Please connect wallet.");

    try {
      // AccessNFT.mint routes the proof through ComplianceGate.verifyCompliance internally
      // (the gate only accepts calls from the AccessNFT contract), then mints the NFT.
      await writeAccessNFT({
        functionName: "mint",
        args: [
          {
            merkleTreeDepth: BigInt(proof.merkleTreeDepth),
            merkleTreeRoot: BigInt(proof.merkleTreeRoot),
            nullifier: BigInt(proof.nullifier),
            message: BigInt(proof.message),
            scope: BigInt(proof.scope),
            points: proof.points.map(p => BigInt(p)) as [
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
            ],
          },
        ],
      });
      notification.success("Compliance Verified & NFT Minted!");
    } catch (e) {
      console.error(e);
      notification.error("Verification failed (maybe already verified or wrong group).");
    }
  };

  return (
    <div className="flex flex-col items-center pt-10 p-4">
      <h1 className="text-4xl font-bold mb-8">ZK-CID Demo</h1>

      <div className="tabs tabs-boxed mb-8">
        <button className={`tab ${activeTab === "user" ? "tab-active" : ""}`} onClick={() => setActiveTab("user")}>
          1. User (Identity & Proof)
        </button>
        <button className={`tab ${activeTab === "issuer" ? "tab-active" : ""}`} onClick={() => setActiveTab("issuer")}>
          2. Issuer (KYC & Add)
        </button>
        <button
          className={`tab ${activeTab === "verifier" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("verifier")}
        >
          3. Verifier (On-Chain)
        </button>
      </div>

      <div className="w-full max-w-3xl bg-base-200 p-8 rounded-xl shadow-xl">
        {activeTab === "user" && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">User Dashboard</h2>
            <p className="opacity-80">
              Your identity stays completely local in your browser. The private key never leaves this device.
            </p>

            {isIdentityLoading ? (
              <span className="loading loading-spinner"></span>
            ) : identity ? (
              <div className="bg-base-300 p-4 rounded-lg overflow-hidden">
                <p className="font-mono text-sm break-all mb-2">
                  <strong>Identity Commitment (Public):</strong>
                  <br />
                  {identity.commitment.toString()}
                </p>
                <button className="btn btn-error btn-sm" onClick={clearIdentity}>
                  Delete Local Identity
                </button>
              </div>
            ) : (
              <div className="flex gap-4">
                <button className="btn btn-primary" onClick={createIdentity}>
                  Generate Random Identity
                </button>
                <button className="btn btn-secondary" onClick={() => createDeterministicIdentity(address)}>
                  Sign to Generate Deterministic Identity
                </button>
              </div>
            )}

            <div className="divider"></div>

            <h3 className="text-xl font-semibold">Generate Zero-Knowledge Proof</h3>
            <p className="text-sm opacity-80">
              Prove you are in the group WITHOUT revealing which commitment belongs to you.
            </p>
            <p className="text-xs">Current Group Size: {isEventsLoading ? "Loading..." : groupMembers.length}</p>
            <button
              className="btn btn-secondary"
              onClick={handleGenerateProof}
              disabled={!identity || isGenerating || groupMembers.length === 0}
            >
              {isGenerating ? <span className="loading loading-spinner"></span> : "Generate ZK Proof"}
            </button>

            {proofError && <p className="text-error">{proofError}</p>}
            {proof && (
              <div className="bg-success text-success-content p-4 rounded-lg overflow-hidden">
                <p>
                  <strong>Proof Generated Successfully!</strong>
                </p>
                <p className="font-mono text-xs truncate">Nullifier: {proof.nullifier.toString()}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "issuer" && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">Issuer Dashboard</h2>
            <p className="opacity-80">
              As an issuer, you simulate verifying a user&apos;s KYC and adding their anonymous commitment to the
              on-chain Semaphore Group.
            </p>
            <p className="text-sm">Group ID: {groupId?.toString() || "Loading..."}</p>

            <button className="btn btn-primary" onClick={handleIssueCredential} disabled={groupId === undefined}>
              Issue Credential (Add to Group)
            </button>

            <p className="text-xs opacity-60">*In this demo, it grabs the commitment from the User tab.</p>
          </div>
        )}

        {activeTab === "verifier" && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">Verifier Dashboard (DeFi Protocol)</h2>
            <p className="opacity-80">
              Submit the ZK Proof to the Smart Contract. The contract will verify the proof and mint an AccessNFT to
              your wallet if valid.
            </p>

            <button className="btn btn-accent" onClick={handleVerifyProof} disabled={!proof || hasMinted}>
              {hasMinted ? "Already Verified" : "Verify Proof & Mint AccessNFT"}
            </button>

            {hasMinted && (
              <div className="mt-8 p-6 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl text-white shadow-2xl transition-all duration-500">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <span className="text-3xl">🔓</span> Secret DeFi Dashboard Unlocked!
                  </h3>
                  <span className="badge badge-warning badge-lg font-bold">Demo UI</span>
                </div>
                <p className="opacity-90 mb-4">
                  You have successfully proved your compliance via ZK. You now have access to the regulated liquidity
                  pools.
                </p>

                <div className="bg-white/20 p-4 rounded-lg backdrop-blur-sm border border-white/30">
                  <div className="flex justify-between items-center mb-2">
                    <span>Your Balance:</span>
                    <span className="font-mono text-xl">100.00 USDC</span>
                  </div>
                  <p className="text-xs opacity-75 mb-2">*Mock balance for demo purposes only — no real funds.</p>
                  <div className="flex gap-2">
                    <button className="btn btn-sm btn-primary flex-1 border-none bg-white text-indigo-700 hover:bg-gray-100">
                      Swap
                    </button>
                    <button className="btn btn-sm btn-primary flex-1 border-none bg-indigo-800 text-white hover:bg-indigo-900">
                      Stake
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
