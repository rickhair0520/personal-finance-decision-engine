"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/ui/Nav";
import ImportUpload from "@/components/budget/ImportUpload";
import ImportMapper from "@/components/budget/ImportMapper";
import { api, ImportRow } from "@/lib/api";

export default function BudgetImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "map">("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [versionName, setVersionName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setParsing(true);
    setError("");
    setVersionName(file.name.replace(".xlsx", ""));
    try {
      const result = await api.budget.parseImport(file);
      setRows(result.rows);
      setStep("map");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm(mappedRows: ImportRow[]) {
    if (!versionName.trim()) {
      setError("Please enter a version name");
      return;
    }
    setImporting(true);
    setError("");
    try {
      await api.budget.confirmImport(versionName, mappedRows);
      router.push("/budget");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/budget")} className="text-gray-400 hover:text-gray-600 text-sm">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Import from Excel</h1>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          <span className={`px-3 py-1 rounded-full font-medium ${step === "upload" ? "bg-indigo-600 text-white" : "bg-green-100 text-green-700"}`}>
            1. Upload
          </span>
          <span className="text-gray-300">→</span>
          <span className={`px-3 py-1 rounded-full font-medium ${step === "map" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400"}`}>
            2. Map columns
          </span>
        </div>

        {step === "upload" && (
          <div className="space-y-4">
            <ImportUpload onFile={handleFile} loading={parsing} />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version name</label>
              <input
                type="text"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Builder Estimate June 2026"
              />
            </div>
            <ImportMapper rows={rows} onConfirm={handleConfirm} loading={importing} />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
