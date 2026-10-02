import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

/// Demo commitment (same magnitude as the live Sepolia demo commitment).
const COMMITMENT = 123456789012345678901234567890123456789n;
const UNKNOWN_COMMITMENT = 987654321098765432109876543210987654321n;

const abi = ethers.AbiCoder.defaultAbiCoder();
const encodeReport = (commitment: bigint, siblings: bigint[] = []) =>
  abi.encode(["uint256", "uint256[]"], [commitment, siblings]);

describe("ComplianceGateReceiver (CRE write path)", function () {
  let mockSemaphore: any;
  let gate: any;
  let receiver: any;
  let issuer: any;
  let forwarder: any;
  let stranger: any;

  beforeEach(async function () {
    [issuer, forwarder, stranger] = await ethers.getSigners();

    const MockSemaphore = await ethers.getContractFactory("MockSemaphore");
    mockSemaphore = await MockSemaphore.deploy();

    const ComplianceGate = await ethers.getContractFactory("ComplianceGate");
    gate = await ComplianceGate.deploy(await mockSemaphore.getAddress());

    const Receiver = await ethers.getContractFactory("ComplianceGateReceiver");
    receiver = await Receiver.deploy(forwarder.address, await gate.getAddress());

    // The issuer authorises the adapter, mirroring the production deployment step.
    await gate.setWorkflow(await receiver.getAddress());
  });

  it("forwards a forwarder report into an on-tree revocation", async function () {
    await gate.issueCredential(COMMITMENT);
    expect(await gate.isMember(COMMITMENT)).to.equal(true);

    await expect(receiver.connect(forwarder).onReport("0x", encodeReport(COMMITMENT)))
      .to.emit(gate, "CredentialRevokedFromTree")
      .withArgs(COMMITMENT, 0);

    expect(await gate.isMember(COMMITMENT)).to.equal(false);
    expect(await gate.hasBeenRevoked(COMMITMENT)).to.equal(true);
  });

  it("passes through real Merkle siblings", async function () {
    await gate.issueCredential(COMMITMENT);
    await gate.issueCredential(UNKNOWN_COMMITMENT);

    // Two-member tree: removing the first member needs its sibling proof.
    const siblings = [UNKNOWN_COMMITMENT];
    await expect(receiver.connect(forwarder).onReport("0x", encodeReport(COMMITMENT, siblings)))
      .to.emit(receiver, "RevocationForwarded")
      .withArgs(COMMITMENT, 1);

    expect(await gate.isMember(COMMITMENT)).to.equal(false);
    expect(await gate.isMember(UNKNOWN_COMMITMENT)).to.equal(true);
  });

  it("rejects any caller that is not the configured forwarder", async function () {
    await gate.issueCredential(COMMITMENT);

    await expect(receiver.connect(stranger).onReport("0x", encodeReport(COMMITMENT))).to.revert(ethers);
    await expect(receiver.connect(issuer).onReport("0x", encodeReport(COMMITMENT))).to.revert(ethers);

    // Nothing happened on-chain.
    expect(await gate.isMember(COMMITMENT)).to.equal(true);
    expect(await gate.hasBeenRevoked(COMMITMENT)).to.equal(false);
  });

  it("rejects an empty report", async function () {
    await expect(receiver.connect(forwarder).onReport("0x", "0x")).to.revert(ethers);
  });

  it("surfaces the gate's own validation for unknown credentials", async function () {
    await expect(receiver.connect(forwarder).onReport("0x", encodeReport(UNKNOWN_COMMITMENT))).to.be.revertedWith(
      "Unknown credential",
    );
  });

  it("exposes the official receiver interface and the configured forwarder", async function () {
    const receiverInterfaceId = ethers.id("onReport(bytes,bytes)").slice(0, 10);
    expect(await receiver.supportsInterface("0x01ffc9a7")).to.equal(true); // IERC165
    expect(await receiver.supportsInterface(receiverInterfaceId)).to.equal(true); // IReceiver
    expect(await receiver.getForwarderAddress()).to.equal(forwarder.address);
    expect(await receiver.complianceGate()).to.equal(await gate.getAddress());
  });

  it("only lets the owner rotate the trusted forwarder", async function () {
    await expect(receiver.connect(stranger).setForwarderAddress(stranger.address)).to.revert(ethers);
    await expect(receiver.setForwarderAddress(stranger.address))
      .to.emit(receiver, "ForwarderAddressUpdated")
      .withArgs(forwarder.address, stranger.address);
    expect(await receiver.getForwarderAddress()).to.equal(stranger.address);
  });
});
