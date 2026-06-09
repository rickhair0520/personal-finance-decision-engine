"use client";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, PlaidLinkOnSuccess } from "react-plaid-link";
import { api } from "@/lib/api";
import { fmt$$ } from "@/lib/utils";

interface SyncResult {
  institution: string;
  checking_balance: number;
  monthly_expenses_estimate: number;
  transaction_count: number;
  date_range: { start: string; end: string };
  transactions: { name: string; amount: number; date: string; category: string }[];
}

interface Props {
  onApply: (balance: number, monthlyExpenses: number) => void;
}

export default function PlaidLink({ onApply }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<{ connected: boolean; institution?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.plaid.status().then(setStatus);
    api.plaid.linkToken().then((r) => setLinkToken(r.link_token)).catch(() => {});
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (public_token, metadata) => {
      setError("");
      try {
        await api.plaid.exchange(public_token, metadata.institution?.name || "Bank");
        setStatus({ connected: true, institution: metadata.institution?.name ?? undefined });
        await handleSync();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Connection failed");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { open, ready } = usePlaidLink({ token: linkToken || "", onSuccess });

  async function handleSync() {
    setSyncing(true);
    setError("");
    try {
      const result = await api.plaid.sync();
      setSyncResult(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      {!status?.connected ? (
        <div className="space-y-2">
          <button
            onClick={async () => {
              setError("");
              setSyncing(true);
              try {
                await api.plaid.sandboxConnect();
                setStatus({ connected: true, institution: "Wells Fargo (sandbox)" });
                await handleSync();
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Connection failed");
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
            className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {syncing ? "Connecting…" : "Connect Wells Fargo (sandbox)"}
          </button>
          <p className="text-xs text-gray-400">
            Connects a test Wells Fargo account with sandbox data instantly.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              {status.institution} connected
            </span>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-sm text-indigo-600 hover:underline disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          </div>

          {syncResult && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-4">
              <p className="text-sm font-semibold text-indigo-900">
                Synced from {syncResult.institution}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-indigo-600 font-medium mb-0.5">Checking Balance</p>
                  <p className="text-lg font-bold text-indigo-900">
                    {fmt$$(syncResult.checking_balance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600 font-medium mb-0.5">Avg Monthly Expenses</p>
                  <p className="text-lg font-bold text-indigo-900">
                    {fmt$$(syncResult.monthly_expenses_estimate)}
                  </p>
                  <p className="text-xs text-indigo-500">
                    from {syncResult.transaction_count} txns · {syncResult.date_range.start} – {syncResult.date_range.end}
                  </p>
                </div>
              </div>

              {syncResult.transactions.length > 0 && (
                <div>
                  <p className="text-xs text-indigo-700 font-semibold uppercase tracking-wide mb-2">
                    Top Transactions
                  </p>
                  <div className="bg-white rounded-lg border border-indigo-100 divide-y divide-indigo-50 max-h-48 overflow-y-auto">
                    {syncResult.transactions.map((t, i) => {
                      const isDebit = t.amount > 0;
                      return (
                        <div key={i} className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold w-4 ${isDebit ? "text-red-500" : "text-green-600"}`}>
                              {isDebit ? "−" : "+"}
                            </span>
                            <div>
                              <p className="text-xs font-medium text-gray-800">{t.name}</p>
                              <p className="text-xs text-gray-400">{t.category} · {t.date}</p>
                            </div>
                          </div>
                          <span className={`text-xs font-semibold ${isDebit ? "text-red-600" : "text-green-600"}`}>
                            {fmt$$(Math.abs(t.amount))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={() =>
                  onApply(syncResult.checking_balance, syncResult.monthly_expenses_estimate)
                }
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Apply to Profile
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
