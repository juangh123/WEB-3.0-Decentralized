import { useCallback, useEffect, useState } from "react";

/**
 * Talks to the server-side demo issuance bridge (`/api/demo-issue`). The issuer private key
 * lives in the server environment; the browser only learns whether the bridge is enabled.
 */
export const useDemoIssuer = () => {
  const [enabled, setEnabled] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo-issue", { cache: "no-store" })
      .then(response => (response.ok ? response.json() : { enabled: false }))
      .then((payload: { enabled?: boolean }) => {
        if (!cancelled) setEnabled(Boolean(payload?.enabled));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const issue = useCallback(async (commitment: string) => {
    setIsIssuing(true);
    try {
      const response = await fetch("/api/demo-issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commitment }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      return payload;
    } finally {
      setIsIssuing(false);
    }
  }, []);

  return { enabled, isIssuing, issue };
};
