export interface SanctionsData {
  source: string;
  updatedAt: string;
  sanctionedCommitments: string[];
}

// Unified public response schema shared with the Express server (server.js):
// { sanctioned: string[], source: string, updatedAt: string }
export interface SanctionsResponse {
  sanctioned: string[];
  source: string;
  updatedAt: string;
}

export function toPublicView(data: SanctionsData): SanctionsResponse {
  return {
    sanctioned: [...data.sanctionedCommitments],
    source: data.source,
    updatedAt: data.updatedAt,
  };
}

const globalStore = globalThis as unknown as { __sanctions?: SanctionsData };

function init(): SanctionsData {
  return {
    source: "Mock OFAC SDN Sanctions List (Demo)",
    updatedAt: new Date().toISOString(),
    // Seed via SEED_SANCTIONED env var (comma-separated); default: empty list.
    sanctionedCommitments: (process.env.SEED_SANCTIONED ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export function getSanctions(): SanctionsData {
  if (!globalStore.__sanctions) globalStore.__sanctions = init();
  return globalStore.__sanctions;
}

export function addSanction(commitment: string): SanctionsData {
  const data = getSanctions();
  if (!data.sanctionedCommitments.includes(commitment)) {
    data.sanctionedCommitments.push(commitment);
    data.updatedAt = new Date().toISOString();
  }
  return data;
}

export function removeSanction(commitment: string): SanctionsData {
  const data = getSanctions();
  data.sanctionedCommitments = data.sanctionedCommitments.filter(
    (c) => c !== commitment
  );
  data.updatedAt = new Date().toISOString();
  return data;
}

export function clearSanctions(): SanctionsData {
  const data = getSanctions();
  data.sanctionedCommitments = [];
  data.updatedAt = new Date().toISOString();
  return data;
}
