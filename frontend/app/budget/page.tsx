"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/ui/Nav";
import VersionCardRow from "@/components/budget/VersionCardRow";
import LineItemTable from "@/components/budget/LineItemTable";
import BudgetSummaryBar from "@/components/budget/BudgetSummaryBar";
import VarianceAnalysisPanel from "@/components/budget/VarianceAnalysisPanel";
import CompareDrawer from "@/components/budget/CompareDrawer";
import { api, BudgetVersionSummary, isLoggedIn } from "@/lib/api";

export default function BudgetPage() {
  const router = useRouter();
  const [versions, setVersions] = useState<BudgetVersionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contingencyPct] = useState(0.15);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/auth/login"); return; }
    api.budget.listVersions().then((vs) => {
      setVersions(vs);
      if (vs.length > 0) setSelectedId(vs.find((v) => v.is_baseline)?.id ?? vs[0].id);
    }).finally(() => setLoading(false));
  }, [router]);

  async function handleNewVersion() {
    const choice = window.prompt(
      'Create new version:\n1 - Start from template\n2 - Duplicate selected\n3 - Import from Excel\n\nEnter 1, 2, or 3:'
    );
    if (choice === "1") {
      const name = window.prompt("Version name:") ?? "New Version";
      const v = await api.budget.createVersion(name);
      setVersions((prev) => [...prev, v]);
      setSelectedId(v.id);
    } else if (choice === "2" && selectedId) {
      const v = await api.budget.duplicateVersion(selectedId);
      setVersions((prev) => [...prev, v]);
      setSelectedId(v.id);
    } else if (choice === "3") {
      router.push("/budget/import");
    }
  }

  async function handleDuplicate(id: string) {
    const v = await api.budget.duplicateVersion(id);
    setVersions((prev) => [...prev, v]);
    setSelectedId(v.id);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this budget version?")) return;
    try {
      await api.budget.deleteVersion(id);
      const updated = versions.filter((v) => v.id !== id);
      setVersions(updated);
      if (selectedId === id) setSelectedId(updated[0]?.id ?? null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Cannot delete version");
    }
  }

  async function handleRename(id: string, name: string) {
    const v = await api.budget.updateVersion(id, { name });
    setVersions((prev) => prev.map((ver) => (ver.id === id ? v : ver)));
  }

  function handleTotalChange(total: number) {
    setVersions((prev) =>
      prev.map((v) => (v.id === selectedId ? { ...v, total } : v))
    );
  }

  const selected = versions.find((v) => v.id === selectedId) ?? null;

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">House Budget</h1>
            <p className="text-sm text-gray-500 mt-0.5">Build and compare construction cost scenarios</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/budget/import")}
              className="text-sm border border-gray-300 bg-white px-3 py-2 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
            >
              ⬆ Import Excel
            </button>
            <button
              onClick={handleNewVersion}
              className="text-sm bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 font-medium"
            >
              + New Version
            </button>
          </div>
        </div>

        {versions.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-3">No budget versions yet</p>
            <button
              onClick={handleNewVersion}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Create your first budget
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <VersionCardRow
              versions={versions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onRename={handleRename}
              onNewVersion={handleNewVersion}
            />

            {selected && (
              <>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowCompare(true)}
                    disabled={versions.length < 2}
                    className="text-sm text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Compare versions
                  </button>
                </div>

                <VarianceAnalysisPanel />

                <LineItemTable
                  versionId={selected.id}
                  versionName={selected.name}
                  onTotalChange={handleTotalChange}
                />

                <BudgetSummaryBar
                  total={selected.total}
                  contingencyPct={contingencyPct}
                />
              </>
            )}
          </div>
        )}
      </main>

      {showCompare && versions.length >= 2 && (
        <CompareDrawer versions={versions} onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
}
