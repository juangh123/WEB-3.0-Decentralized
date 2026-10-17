"use client";

import { useCallback, useState } from "react";
import { useLanguage } from "./LanguageContext";
import { useScaffoldWatchContractEvent } from "~~/hooks/scaffold-eth";

type Revocation = { commitment: string; txHash: string };

const MAX_ENTRIES = 5;

/**
 * Live view of CRE-driven revocations: listens for ComplianceGate revocation events while the
 * page is open and keeps the most recent entries. Historical backfill is intentionally not done
 * here because event-history reads from block 0 time out on public Sepolia RPC endpoints.
 */
export const RevocationFeed = () => {
  const { t } = useLanguage();
  const [revocations, setRevocations] = useState<Revocation[]>([]);

  const recordRevocations = useCallback((logs: readonly unknown[]) => {
    const entries: Revocation[] = [];
    for (const log of logs) {
      const candidate = log as { args?: { commitment?: bigint }; transactionHash?: string };
      if (candidate.args?.commitment === undefined || !candidate.transactionHash) continue;
      entries.push({ commitment: candidate.args.commitment.toString(), txHash: candidate.transactionHash });
    }
    if (entries.length === 0) return;
    setRevocations(previous => {
      const merged = [...entries.reverse(), ...previous];
      const seen = new Set<string>();
      return merged
        .filter(entry => {
          const key = `${entry.txHash}:${entry.commitment}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, MAX_ENTRIES);
    });
  }, []);

  useScaffoldWatchContractEvent({
    contractName: "ComplianceGate",
    eventName: "CredentialRevokedFromTree",
    onLogs: recordRevocations,
  });
  useScaffoldWatchContractEvent({
    contractName: "ComplianceGate",
    eventName: "CredentialRevoked",
    onLogs: recordRevocations,
  });

  return (
    <div className="mt-4 border-t border-base-300 pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold">{t("链上撤销记录（实时监听）", "On-chain revocations (live)")}</span>
        <span className="opacity-60">
          {t(`最近 ${revocations.length}/${MAX_ENTRIES} 条`, `Latest ${revocations.length}/${MAX_ENTRIES}`)}
        </span>
      </div>
      {revocations.length === 0 ? (
        <p className="opacity-60">
          {t("暂无新撤销事件（页面打开期间实时监听）", "No new revocations while this page is open")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {revocations.map(entry => (
            <li
              key={`${entry.txHash}:${entry.commitment}`}
              className="flex items-center justify-between gap-3 font-mono"
            >
              <span className="truncate max-w-[220px]" title={entry.commitment}>
                {entry.commitment.slice(0, 14)}…
              </span>
              <a
                className="link shrink-0"
                href={`https://sepolia.etherscan.io/tx/${entry.txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("交易", "Tx")}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
