"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPublicView = toPublicView;
exports.getSanctions = getSanctions;
exports.addSanction = addSanction;
exports.removeSanction = removeSanction;
exports.clearSanctions = clearSanctions;
function toPublicView(data) {
  return {
    sanctioned: [...data.sanctionedCommitments],
    source: data.source,
    updatedAt: data.updatedAt,
  };
}
const globalStore = globalThis;
function init() {
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
function getSanctions() {
  if (!globalStore.__sanctions) globalStore.__sanctions = init();
  return globalStore.__sanctions;
}
function addSanction(commitment) {
  const data = getSanctions();
  if (!data.sanctionedCommitments.includes(commitment)) {
    data.sanctionedCommitments.push(commitment);
    data.updatedAt = new Date().toISOString();
  }
  return data;
}
function removeSanction(commitment) {
  const data = getSanctions();
  data.sanctionedCommitments = data.sanctionedCommitments.filter(
    (c) => c !== commitment,
  );
  data.updatedAt = new Date().toISOString();
  return data;
}
function clearSanctions() {
  const data = getSanctions();
  data.sanctionedCommitments = [];
  data.updatedAt = new Date().toISOString();
  return data;
}
