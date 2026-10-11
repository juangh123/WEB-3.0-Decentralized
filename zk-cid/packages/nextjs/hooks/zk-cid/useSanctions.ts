import { useEffect, useState } from "react";

export type SanctionsPayload = {
  sanctioned: string[];
  source: string | null;
  updatedAt: string | null;
  error: string | null;
};

/**
 * Fetches the sanctions list through the same-origin `/api/sanctions` proxy (the browser never
 * talks to the mock API cross-origin) and mirrors the data source used by the CRE workflow.
 */
export const useSanctions = () => {
  const [sanctions, setSanctions] = useState<SanctionsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetch("/api/sanctions", { cache: "no-store", signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(payload => {
        if (!cancelled) setSanctions(payload as SanctionsPayload);
      })
      .catch(error => {
        if (!cancelled) {
          setSanctions({ sanctioned: [], source: null, updatedAt: null, error: String(error?.message ?? error) });
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { sanctions };
};
