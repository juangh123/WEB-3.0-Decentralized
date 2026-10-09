import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import deployedContracts from "~~/contracts/deployedContracts";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

// Server-only demo issuance bridge. The issuer private key lives in DEMO_ISSUER_KEY and is
// never sent to the browser; this route exposes only `issueCredential`, not `setWorkflow`
// or `setDemoMode`, so the key cannot be used to change the gate's configuration.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = Math.max(1, Number.parseInt(process.env.DEMO_ISSUER_RATE_LIMIT ?? "20", 10) || 20);
const MAX_BUCKETS = 5_000;

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

type IssuerAccount = ReturnType<typeof privateKeyToAccount>;
let cachedIssuerAccount: IssuerAccount | null | undefined;

const getIssuerAccount = (): IssuerAccount | null => {
  if (cachedIssuerAccount !== undefined) return cachedIssuerAccount;

  const key = process.env.DEMO_ISSUER_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    cachedIssuerAccount = null;
    return cachedIssuerAccount;
  }

  try {
    cachedIssuerAccount = privateKeyToAccount(key as `0x${string}`);
  } catch {
    cachedIssuerAccount = null;
  }
  return cachedIssuerAccount;
};

const isDemoIssuerEnabled = () => getIssuerAccount() !== null && process.env.DEMO_ISSUER_ENABLED !== "false";

const getRpcUrl = () =>
  process.env.DEMO_ISSUER_RPC_URL || getAlchemyHttpUrl(sepolia.id) || "https://ethereum-sepolia-rpc.publicnode.com";

const getGate = () => {
  const configuredAddress = process.env.DEMO_ISSUER_GATE_ADDRESS;
  if (configuredAddress && !isAddress(configuredAddress)) {
    throw new Error("DEMO_ISSUER_GATE_ADDRESS is not a valid address");
  }

  return {
    address: (configuredAddress || deployedContracts[sepolia.id].ComplianceGate.address) as `0x${string}`,
    abi: deployedContracts[sepolia.id].ComplianceGate.abi,
  };
};

const consumeRateLimit = (key: string) => {
  const now = Date.now();

  if (rateBuckets.size >= MAX_BUCKETS) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
  }

  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;

  bucket.count += 1;
  return true;
};

const getClientKey = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
};

export async function GET() {
  const account = getIssuerAccount();
  return NextResponse.json({
    enabled: isDemoIssuerEnabled(),
    issuer: account?.address ?? null,
    chainId: sepolia.id,
  });
}

export async function POST(request: Request) {
  if (!isDemoIssuerEnabled()) {
    return NextResponse.json({ error: "Demo issuer is not configured" }, { status: 503 });
  }

  const account = getIssuerAccount();
  if (!account) {
    return NextResponse.json({ error: "Demo issuer is not configured" }, { status: 503 });
  }

  if (!consumeRateLimit(getClientKey(request))) {
    return NextResponse.json({ error: "Too many issuance requests, try again later" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawCommitment = (body as { commitment?: unknown } | null)?.commitment;
  if (typeof rawCommitment !== "string") {
    return NextResponse.json({ error: "commitment must be a decimal string" }, { status: 400 });
  }

  const trimmedCommitment = rawCommitment.trim();
  if (!/^[0-9]{1,78}$/.test(trimmedCommitment)) {
    return NextResponse.json({ error: "commitment must be a decimal string" }, { status: 400 });
  }

  let commitment: bigint;
  try {
    commitment = BigInt(trimmedCommitment);
  } catch {
    return NextResponse.json({ error: "commitment must be a decimal string" }, { status: 400 });
  }

  if (commitment <= 0n || commitment >= SNARK_SCALAR_FIELD) {
    return NextResponse.json({ error: "commitment is outside the Semaphore scalar field" }, { status: 400 });
  }

  try {
    const { address, abi } = getGate();
    const rpcUrl = getRpcUrl();
    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });

    const onChainIssuer = await publicClient.readContract({
      address,
      abi,
      functionName: "issuer",
    });
    if (onChainIssuer.toLowerCase() !== account.address.toLowerCase()) {
      console.error("[demo-issue] configured key does not match the on-chain issuer");
      return NextResponse.json({ error: "Demo issuer key does not match the on-chain issuer" }, { status: 500 });
    }

    const alreadyIssued = await publicClient.readContract({
      address,
      abi,
      functionName: "isMember",
      args: [commitment],
    });
    if (alreadyIssued) {
      return NextResponse.json({ status: "already-issued", commitment: commitment.toString() });
    }

    const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
    const txHash = await walletClient.writeContract({
      address,
      abi,
      functionName: "issueCredential",
      args: [commitment],
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
      timeout: 45_000,
    });
    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Issuance transaction reverted" }, { status: 502 });
    }

    return NextResponse.json({ status: "issued", txHash, commitment: commitment.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already issued/i.test(message)) {
      return NextResponse.json({ status: "already-issued", commitment: commitment.toString() });
    }

    console.error("[demo-issue] issuance failed:", message);
    return NextResponse.json({ error: "Issuance transaction failed" }, { status: 502 });
  }
}
