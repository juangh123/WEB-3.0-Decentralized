#!/usr/bin/env node
/**
 * Fails when the Sepolia deployment records, the CRE workflow config and the generated
 * frontend contract map disagree about a contract address.
 *
 * Single source of truth: `packages/hardhat/deployments/sepolia/*.json`, written by the deploy
 * scripts. Run it with `yarn check:addresses`; CI runs it on every push.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deploymentsDir = join(root, "packages", "hardhat", "deployments", "sepolia");
const workflowConfigPath = join(root, "workflows", "compliance-lifecycle", "config.json");
const frontendContractsPath = join(root, "packages", "nextjs", "contracts", "deployedContracts.ts");

const errors = [];
const infos = [];
const norm = value => (typeof value === "string" ? value.toLowerCase() : "");

const deployments = {};
for (const file of readdirSync(deploymentsDir)) {
  if (!file.endsWith(".json")) continue;
  const record = JSON.parse(readFileSync(join(deploymentsDir, file), "utf8"));
  if (typeof record.address === "string") deployments[file.replace(/\.json$/, "")] = record.address;
}

const config = JSON.parse(readFileSync(workflowConfigPath, "utf8"));
const configPairs = [
  ["complianceGateAddress", "ComplianceGate"],
  ["receiverAddress", "ComplianceGateReceiver"],
];
for (const [configKey, contractName] of configPairs) {
  const configAddress = config[configKey];
  const deployedAddress = deployments[contractName];
  if (!configAddress) {
    errors.push(`workflow config is missing ${configKey}`);
  } else if (!deployedAddress) {
    errors.push(`deployments/sepolia/${contractName}.json is missing`);
  } else if (norm(configAddress) !== norm(deployedAddress)) {
    errors.push(
      `workflow config ${configKey}=${configAddress} != deployments/sepolia/${contractName}.json address=${deployedAddress}`,
    );
  }
}

if (!existsSync(frontendContractsPath)) {
  errors.push(`missing ${frontendContractsPath}`);
} else {
  const text = readFileSync(frontendContractsPath, "utf8");
  const start = text.indexOf("11155111:");
  if (start < 0) {
    errors.push("deployedContracts.ts has no 11155111 section");
  } else {
    // The generated file lists chain ids in ascending order, so the Sepolia section runs to EOF.
    const section = text.slice(start);
    const frontend = {};
    for (const match of section.matchAll(/([A-Za-z0-9_]+):\s*\{\s*address:\s*"(0x[0-9a-fA-F]{40})"/g)) {
      frontend[match[1]] = match[2];
    }
    for (const [name, deployedAddress] of Object.entries(deployments)) {
      if (!frontend[name]) {
        infos.push(`deployedContracts.ts (11155111) has no entry for ${name}; skipped`);
        continue;
      }
      if (norm(frontend[name]) !== norm(deployedAddress)) {
        errors.push(
          `deployedContracts.ts ${name}=${frontend[name]} != deployments/sepolia/${name}.json address=${deployedAddress}`,
        );
      }
    }
  }
}

for (const info of infos) console.log(`info: ${info}`);
if (errors.length > 0) {
  console.error("Address consistency check FAILED:");
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log("Address consistency check passed: deployment records == workflow config == generated frontend map.");
